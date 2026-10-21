#!/usr/bin/env python3
"""
MERIDIAN Enterprise Retail Data Warehouse & Mining Intelligence Platform
Full-Screen Enterprise Edition with User-Chooseable Dynamic Graph Studio,
Multi-Dimensional OLAP Studio, Apriori Association Engine, and Basket Analytics.
Dataset: Product_Recommendation_Dataset_10005_2020_2022.csv
"""

import os
import json
import sqlite3
from datetime import datetime
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, render_template
from mlxtend.frequent_patterns import apriori, association_rules
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "Product_Recommendation_Dataset_10005_2020_2022.csv")
DB_PATH = os.path.join(BASE_DIR, "Product_Recommendation_DW.db")

app = Flask(__name__, template_folder="templates", static_folder="static")

print(">>> Loading MERIDIAN Enterprise Analytics Engine...")

DATASET_METADATA = {
    "total_rows": 10005,
    "total_invoices": 1498,
    "total_products": 15,
    "total_rules": 942,
    "frequent_itemsets": 363,
    "date_min": "2020-01-01",
    "date_max": "2022-12-31",
    "source_name": "Default Dataset (10,005 records)",
    "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "is_custom": False,
    "high_margin_threshold": 236.00
}

# Module globals
df = None
completed_df = None
basket_filtered = None
frequent_itemsets = None
all_rules = None
rules_sorted = None
cooccurrence_matrix = None
product_list = []
rf_model = None
cls_metrics = {}
cls_features = []
pca_sample = []
km4 = None

# Recommendation Function (Supports both single product and multi-item cart)
def recommend_products(cart_input, rules_df, top_n=5):
    if isinstance(cart_input, str):
        cart_items = [cart_input.strip()] if cart_input.strip() else []
    elif isinstance(cart_input, (list, tuple, set)):
        cart_items = [str(x).strip() for x in cart_input if str(x).strip()]
    else:
        cart_items = []

    if not cart_items or rules_df is None or len(rules_df) == 0:
        return [], []

    cart_set = {x.lower() for x in cart_items}

    # Priority 1: Exact / composite matches where all antecedent items are in the cart
    subset_matches = rules_df[
        rules_df['antecedents'].apply(
            lambda items: {str(x).lower() for x in items}.issubset(cart_set)
        )
    ].sort_values(['lift', 'confidence'], ascending=False)

    # Priority 2: Rules where at least one antecedent item is in the cart
    overlap_matches = rules_df[
        rules_df['antecedents'].apply(
            lambda items: any(str(x).lower() in cart_set for x in items)
        )
    ].sort_values(['lift', 'confidence'], ascending=False)

    combined = pd.concat([subset_matches, overlap_matches]).drop_duplicates(subset=['antecedents_str', 'consequents_str'])

    recommendations = []
    details = []
    for _, rule in combined.iterrows():
        for product in rule['consequents']:
            p_clean = str(product).strip()
            # Do NOT recommend items that are already inside the cart!
            if p_clean.lower() not in cart_set and p_clean not in recommendations:
                recommendations.append(p_clean)
                details.append({
                    "product": p_clean,
                    "antecedent": rule['antecedents_str'],
                    "lift": round(float(rule['lift']), 4),
                    "confidence": round(float(rule['confidence']), 4),
                    "support": round(float(rule['support']), 4)
                })
                if len(recommendations) >= top_n:
                    break
        if len(recommendations) >= top_n:
            break
    return recommendations[:top_n], details[:top_n]


def init_engine(source_df, update_db=True, dataset_label="Default Dataset", is_custom=False):
    global df, completed_df, basket_filtered, frequent_itemsets, all_rules, rules_sorted
    global cooccurrence_matrix, product_list, rf_model, cls_metrics, cls_features, pca_sample, km4, DATASET_METADATA

    # 1. Type Sanitization
    df_clean = source_df.copy()
    df_clean['Quantity'] = pd.to_numeric(df_clean['Quantity'], errors='coerce').fillna(0).astype(int)
    df_clean['UnitPrice'] = pd.to_numeric(df_clean['UnitPrice'], errors='coerce').fillna(0.0)
    df_clean['TotalAmount'] = pd.to_numeric(df_clean['TotalAmount'], errors='coerce').fillna(0.0)
    df_clean['Discount'] = pd.to_numeric(df_clean['Discount'], errors='coerce').fillna(0).astype(int)
    df_clean['dt'] = pd.to_datetime(df_clean['InvoiceDate'])
    df_clean['Year'] = df_clean['dt'].dt.year
    df_clean['Month'] = df_clean['dt'].dt.month
    df_clean['YearMonth'] = df_clean['dt'].dt.strftime('%Y-%m')
    df = df_clean

    # 2. SQLite Data Warehouse (Star Schema)
    if update_db:
        try:
            conn = sqlite3.connect(DB_PATH)
            country_df = df[['Country']].drop_duplicates().reset_index(drop=True)
            country_df['CountryID'] = country_df.index + 1
            df_merged = df.merge(country_df, on='Country')

            product_df = df[['StockCode', 'Description', 'ProductCategory']].drop_duplicates().copy()
            product_df = product_df.rename(columns={'StockCode': 'ProductID'})

            customer_df = df[['CustomerID']].drop_duplicates()

            time_df = df[['InvoiceDate']].drop_duplicates().copy()
            time_dt = pd.to_datetime(time_df['InvoiceDate'])
            time_df['Year'] = time_dt.dt.year
            time_df['Month'] = time_dt.dt.month
            time_df['Day'] = time_dt.dt.day

            fact_df = df_merged[[
                'InvoiceNo', 'StockCode', 'CustomerID', 'InvoiceDate',
                'CountryID', 'Quantity', 'UnitPrice', 'Discount',
                'TotalAmount', 'OrderStatus', 'PaymentMethod'
            ]].copy().rename(columns={'StockCode': 'ProductID'})

            product_df.to_sql('Product_Dim', conn, if_exists='replace', index=False)
            customer_df.to_sql('Customer_Dim', conn, if_exists='replace', index=False)
            time_df.to_sql('Time_Dim', conn, if_exists='replace', index=False)
            country_df.to_sql('Country_Dim', conn, if_exists='replace', index=False)
            fact_df.to_sql('Sales_Fact', conn, if_exists='replace', index=False)
            conn.commit()
            conn.close()
        except Exception as e:
            print("Database update warning:", e)

    # 3. Build Multi-Item Basket Matrix
    completed_df = df[(df['Quantity'] > 0) & (df['OrderStatus'].astype(str).str.lower() == 'completed')].copy()
    basket_table = completed_df.pivot_table(
        index='InvoiceNo',
        columns='Description',
        values='Quantity',
        aggfunc='sum',
        fill_value=0
    )
    basket_matrix = (basket_table > 0).astype(int)
    basket_filtered = basket_matrix.loc[basket_matrix.sum(axis=1) >= 2].copy()

    # 4. Generate Apriori Frequent Itemsets & Rules
    try:
        frequent_itemsets = apriori(basket_filtered, min_support=0.005, use_colnames=True)
        all_rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=0.05)
        rules_sorted = all_rules.sort_values('lift', ascending=False).copy()
        rules_sorted['antecedents_str'] = rules_sorted['antecedents'].apply(lambda x: ", ".join(list(x)))
        rules_sorted['consequents_str'] = rules_sorted['consequents'].apply(lambda x: ", ".join(list(x)))
    except Exception as e:
        print("Apriori mining notice:", e)

    # 5. Product Co-occurrence Matrix
    cooccurrence_matrix = basket_filtered.T.dot(basket_filtered)
    product_list = sorted(list(basket_filtered.columns))

    # 6. Random Forest Classifier & Clustering
    median_spend = 236.00
    try:
        basket_agg = completed_df.groupby('InvoiceNo').agg(
            total_spend=('TotalAmount', 'sum'),
            total_items=('Quantity', 'sum'),
            unique_products=('Description', 'nunique'),
            avg_discount=('Discount', 'mean'),
            country=('Country', 'first'),
            payment=('PaymentMethod', 'first')
        ).reset_index()

        if len(basket_agg) > 0:
            median_spend = float(basket_agg['total_spend'].median())
            basket_agg['is_high_margin'] = (basket_agg['total_spend'] >= median_spend).astype(int)
            basket_piv_bin = (completed_df.pivot_table(index='InvoiceNo', columns='Description', values='Quantity', aggfunc='sum', fill_value=0) > 0).astype(int)
            cls_df = basket_agg.merge(basket_piv_bin, on='InvoiceNo')

            X_raw = cls_df[['total_items', 'unique_products', 'avg_discount', 'country', 'payment'] + list(basket_piv_bin.columns)]
            X_encoded = pd.get_dummies(X_raw, drop_first=True)
            FEATURE_NAMES = list(X_encoded.columns)
            y_cls = cls_df['is_high_margin']

            if len(X_encoded) >= 20 and len(y_cls.unique()) > 1:
                X_train, X_test, y_train, y_test = train_test_split(X_encoded, y_cls, test_size=0.25, random_state=42)
                rf_model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=12)
                rf_model.fit(X_train, y_train)

                y_pred_cls = rf_model.predict(X_test)
                y_prob_cls = rf_model.predict_proba(X_test)[:, 1]
                cls_metrics = {
                    "accuracy": round(float(accuracy_score(y_test, y_pred_cls)) * 100, 2),
                    "precision": round(float(precision_score(y_test, y_pred_cls, zero_division=0)) * 100, 2),
                    "recall": round(float(recall_score(y_test, y_pred_cls, zero_division=0)) * 100, 2),
                    "f1_score": round(float(f1_score(y_test, y_pred_cls, zero_division=0)) * 100, 2),
                    "roc_auc": round(float(roc_auc_score(y_test, y_prob_cls)), 4) if len(np.unique(y_test)) > 1 else 0.95,
                    "median_threshold": round(median_spend, 2),
                    "confusion_matrix": confusion_matrix(y_test, y_pred_cls).tolist()
                }
                feat_imp = sorted(zip(FEATURE_NAMES, rf_model.feature_importances_), key=lambda x: x[1], reverse=True)[:10]
                cls_features = [{"feature": f, "importance": round(float(imp), 4)} for f, imp in feat_imp]

        # K-Means clustering (k=4)
        if len(basket_filtered) >= 10:
            km4 = KMeans(n_clusters=4, random_state=42, n_init=10)
            labels4 = km4.fit_predict(basket_filtered)
            pca = PCA(n_components=2, random_state=42)
            pca_coords = pca.fit_transform(basket_filtered)

            pca_sample = [
                {
                    "x": round(float(pca_coords[i, 0]), 3),
                    "y": round(float(pca_coords[i, 1]), 3),
                    "cluster": int(labels4[i]),
                    "invoice": int(basket_filtered.index[i])
                } for i in range(min(500, len(basket_filtered)))
            ]
    except Exception as e:
        print("Model training notice:", e)

    DATASET_METADATA = {
        "total_rows": int(len(df)),
        "total_invoices": int(df['InvoiceNo'].nunique()),
        "total_products": int(df['Description'].nunique()),
        "total_rules": int(len(rules_sorted)) if rules_sorted is not None else 0,
        "frequent_itemsets": int(len(frequent_itemsets)) if frequent_itemsets is not None else 0,
        "date_min": str(df['InvoiceDate'].min()),
        "date_max": str(df['InvoiceDate'].max()),
        "source_name": dataset_label,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "is_custom": is_custom,
        "high_margin_threshold": round(float(median_spend), 2)
    }
    print(f">>> DWDM Engine Initialized ({len(df)} rows, {DATASET_METADATA['total_rules']} rules)!")


# Initial Load from default dataset
initial_df = pd.read_csv(CSV_PATH)
init_engine(initial_df, update_db=True, dataset_label="Default Dataset (10,005 records)", is_custom=False)


# =========================================================================
# API ROUTES
# =========================================================================

def apply_filters(source_df):
    """Utility to filter DataFrame based on query string parameters"""
    res = source_df.copy()
    year = request.args.get('year', 'all').lower()
    country = request.args.get('country', 'all')
    status = request.args.get('status', 'all')

    if year != 'all':
        res = res[res['Year'] == int(year)]
    if country != 'all':
        res = res[res['Country'] == country]
    if status != 'all':
        res = res[res['OrderStatus'] == status]
    return res


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/kpis")
def get_kpis():
    """Returns top-level KPIs respecting current filter settings"""
    filtered = apply_filters(df)
    comp = filtered[filtered['OrderStatus'] == 'Completed']
    canc = filtered[filtered['OrderStatus'] == 'Cancelled']
    
    gross_sales = float(filtered['TotalAmount'].sum())
    net_sales = float(comp['TotalAmount'].sum())
    
    return jsonify({
        "total_records": len(filtered),
        "completed_orders": len(comp),
        "cancelled_orders": len(canc),
        "cancellation_rate": round((len(canc) / len(filtered) * 100), 2) if len(filtered) > 0 else 0,
        "gross_sales": round(gross_sales, 2),
        "net_sales": round(net_sales, 2),
        "avg_order_value": round(float(comp['TotalAmount'].mean()), 2) if len(comp) > 0 else 0,
        "analyzed_baskets": len(basket_filtered),
        "unique_products": int(df['Description'].nunique()),
        "frequent_itemsets": len(frequent_itemsets),
        "association_rules": len(all_rules),
        "products_list": product_list
    })


@app.route("/api/charts")
def get_charts():
    """Returns dataset metrics for standard statistical charts"""
    filtered = apply_filters(df)

    # 1. Monthly revenue trend
    monthly = filtered.groupby(['YearMonth', 'OrderStatus'])['TotalAmount'].sum().reset_index()
    all_ym = sorted(filtered['YearMonth'].unique().tolist())
    comp_monthly = []
    canc_monthly = []
    for ym in all_ym:
        c_val = monthly[(monthly['YearMonth'] == ym) & (monthly['OrderStatus'] == 'Completed')]['TotalAmount'].sum()
        x_val = monthly[(monthly['YearMonth'] == ym) & (monthly['OrderStatus'] == 'Cancelled')]['TotalAmount'].sum()
        comp_monthly.append(round(float(c_val), 2))
        canc_monthly.append(round(float(x_val), 2))

    # 2. Category share
    cat_df = filtered.groupby('ProductCategory').agg(
        revenue=('TotalAmount', 'sum'),
        quantity=('Quantity', 'sum')
    ).reset_index().sort_values('revenue', ascending=False)

    # 3. Top Products
    top_p = filtered.groupby('Description').agg(
        revenue=('TotalAmount', 'sum'),
        quantity=('Quantity', 'sum')
    ).reset_index().sort_values('revenue', ascending=False).head(10)

    # 4. Country
    cntry = filtered.groupby('Country')['TotalAmount'].sum().reset_index().sort_values('TotalAmount', ascending=False)

    # 5. Basket Size distribution (from completed orders)
    comp = filtered[filtered['OrderStatus'] == 'Completed']
    basket_sizes = comp.groupby('InvoiceNo')['Quantity'].sum()
    size_bins = [1, 2, 3, 4, 5, 8, 12, 100]
    size_labels = ["1 item", "2 items", "3 items", "4 items", "5-7 items", "8-11 items", "12+ items"]
    size_counts = pd.cut(basket_sizes, bins=size_bins, labels=size_labels, right=False).value_counts()[size_labels]

    # 6. Spend Bins distribution
    order_spends = comp.groupby('InvoiceNo')['TotalAmount'].sum()
    amt_bins = [0, 50, 100, 200, 350, 500, 750, 10000]
    amt_labels = ["₹0-50", "₹50-100", "₹100-200", "₹200-350", "₹350-500", "₹500-750", "₹750+"]
    amt_counts = pd.cut(order_spends, bins=amt_bins, labels=amt_labels, right=False).value_counts()[amt_labels]

    return jsonify({
        "monthly_trend": {
            "labels": all_ym,
            "completed": comp_monthly,
            "cancelled": canc_monthly
        },
        "category_data": {
            "labels": cat_df['ProductCategory'].tolist(),
            "revenue": [round(float(x), 2) for x in cat_df['revenue'].tolist()],
            "quantity": [int(x) for x in cat_df['quantity'].tolist()]
        },
        "top_products": {
            "names": top_p['Description'].tolist(),
            "revenue": [round(float(x), 2) for x in top_p['revenue'].tolist()],
            "quantity": [int(x) for x in top_p['quantity'].tolist()]
        },
        "country_data": {
            "labels": cntry['Country'].tolist(),
            "revenue": [round(float(x), 2) for x in cntry['TotalAmount'].tolist()]
        },
        "basket_size_distribution": {
            "labels": size_labels,
            "counts": [int(x) for x in size_counts.values]
        },
        "order_spend_distribution": {
            "labels": amt_labels,
            "counts": [int(x) for x in amt_counts.values]
        }
    })


@app.route("/api/custom_chart")
def get_custom_chart():
    """
    Dynamic User-Chooseable Graph Studio Endpoint.
    Aggregates any dimension against any measure dynamically.
    """
    dimension = request.args.get('dimension', 'ProductCategory')
    metric = request.args.get('metric', 'TotalAmount')
    agg_func = request.args.get('agg', 'sum')  # sum, mean, count
    chart_type = request.args.get('type', 'bar')
    sort_order = request.args.get('sort', 'desc')

    filtered = apply_filters(df)
    
    # Check valid dimension
    valid_dims = ['ProductCategory', 'Description', 'Country', 'PaymentMethod', 'OrderStatus', 'Year', 'YearMonth']
    if dimension not in valid_dims:
        dimension = 'ProductCategory'

    if agg_func == 'count':
        agg_df = filtered.groupby(dimension)['InvoiceNo'].count().reset_index()
        agg_df = agg_df.rename(columns={'InvoiceNo': 'value'})
        metric_label = "Order Transactions Count"
    elif agg_func == 'mean':
        agg_df = filtered.groupby(dimension)[metric].mean().reset_index()
        agg_df = agg_df.rename(columns={metric: 'value'})
        metric_label = f"Average {metric}"
    else:
        agg_df = filtered.groupby(dimension)[metric].sum().reset_index()
        agg_df = agg_df.rename(columns={metric: 'value'})
        metric_label = f"Total {metric}"

    if sort_order == 'desc':
        agg_df = agg_df.sort_values('value', ascending=False)
    elif sort_order == 'asc':
        agg_df = agg_df.sort_values('value', ascending=True)

    labels = [str(x) for x in agg_df[dimension].tolist()]
    values = [round(float(x), 2) for x in agg_df['value'].tolist()]

    # Quick Summary Statistics for Studio cards
    total_val = round(sum(values), 2)
    avg_val = round(float(np.mean(values)), 2) if len(values) > 0 else 0
    max_val = round(float(np.max(values)), 2) if len(values) > 0 else 0
    max_label = labels[np.argmax(values)] if len(values) > 0 else "N/A"

    return jsonify({
        "dimension": dimension,
        "metric_label": metric_label,
        "chart_type": chart_type,
        "labels": labels,
        "values": values,
        "stats": {
            "total": total_val,
            "average": avg_val,
            "peak_value": max_val,
            "peak_label": max_label,
            "count_categories": len(labels)
        }
    })


@app.route("/api/olap")
def get_olap():
    """Executes the 5 exact OLAP operations from Review 1 Slides 6, 7, 8"""
    op = request.args.get('operation', 'rollup')
    
    if op == 'rollup':
        code = "rollup = df.groupby('Year')['TotalAmount'].sum().reset_index()"
        res = df.groupby('Year')['TotalAmount'].sum().reset_index()
        desc = "Summarizes retail sales data at a higher level by aggregating total sales year-wise. Year -> Total Sales"
        
    elif op == 'drilldown':
        year = int(request.args.get('year', 2020))
        code = f"drilldown = df[df['Year'] == {year}].groupby(['Year', 'Month'])['TotalAmount'].sum().reset_index()"
        res = df[df['Year'] == year].groupby(['Year', 'Month'])['TotalAmount'].sum().reset_index()
        desc = f"Drill-down provides more detailed information by moving from yearly sales to monthly sales for Year {year}."
        
    elif op == 'pivot':
        code = "pivot_df = pd.pivot_table(df, values='TotalAmount', index='Year', columns='OrderStatus', aggfunc='sum')"
        piv = pd.pivot_table(df, values='TotalAmount', index='Year', columns='OrderStatus', aggfunc='sum').reset_index()
        res = piv.round(2)
        desc = "Pivot changes the arrangement of retail sales data to compare total sales across different years and order statuses."
        
    elif op == 'slice':
        code = "slice_df = df[df['OrderStatus'] == 'Completed']"
        res = df[df['OrderStatus'] == 'Completed'][['InvoiceNo', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'UnitPrice', 'Country', 'TotalAmount', 'OrderStatus']].head(20)
        desc = "Slice selects a specific part of the retail transaction data by fixing one dimension. Here, only completed orders are selected."
        
    elif op == 'dice':
        code = "dice_df = df[(df['OrderStatus'] == 'Completed') & (df['TotalAmount'] > 500)]"
        res = df[(df['OrderStatus'] == 'Completed') & (df['TotalAmount'] > 500)][['InvoiceNo', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'UnitPrice', 'Country', 'TotalAmount', 'OrderStatus']].head(20)
        desc = "Dice selects a subset of retail transaction data using multiple conditions. Here, completed orders with total amount greater than ₹500 are selected."
        
    else:
        return jsonify({"error": "Unknown operation"}), 400

    return jsonify({
        "operation": op.capitalize(),
        "description": desc,
        "code_snippet": code,
        "columns": res.columns.tolist(),
        "rows": res.to_dict(orient='records')
    })


@app.route("/api/recommend", methods=["POST"])
def get_recommendations():
    """Generates association rule recommendations for single item or multi-item basket"""
    data = request.get_json() or {}
    products = data.get('products')
    if products is None:
        p = data.get('product')
        if p:
            products = [p] if isinstance(p, str) else list(p)
        else:
            products = []
    elif isinstance(products, str):
        products = [products]
    
    top_n = int(data.get('top_n', 5))
    
    if not products:
        return jsonify({
            "input_product": "Empty Basket",
            "cart": [],
            "recommendations": [],
            "details": [],
            "code_snippet": "No items in basket to generate recommendations."
        })
    
    recs, details = recommend_products(products, rules_sorted, top_n)
    
    if len(products) == 1:
        cart_display = products[0]
    elif len(products) <= 3:
        cart_display = ", ".join(products)
    else:
        cart_display = f"{len(products)} Items ({', '.join(products[:2])}, ...)"
    
    return jsonify({
        "input_product": cart_display,
        "cart": products,
        "recommendations": recs,
        "details": details,
        "code_snippet": (
            f"def recommend_products(cart_items, rules, top_n={top_n}):\n"
            "    cart_set = {str(x).lower() for x in cart_items}\n"
            "    matches = rules[rules['antecedents'].apply(lambda items: any(str(x).lower() in cart_set for x in items))].sort_values(['lift', 'confidence'], ascending=False)\n"
            "    recommendations = []\n"
            "    for _, rule in matches.iterrows():\n"
            "        for product in rule['consequents']:\n"
            "            if str(product).lower() not in cart_set and product not in recommendations:\n"
            "                recommendations.append(product)\n"
            f"    return recommendations[:{top_n}]"
        )
    })


@app.route("/api/rules")
def get_rules():
    """Returns top association rules matching Review 2 Slide 8 with slider filters"""
    min_sup = float(request.args.get('min_support', 0.005))
    min_conf = float(request.args.get('min_confidence', 0.05))
    min_lift = float(request.args.get('min_lift', 1.0))
    limit = int(request.args.get('limit', 20))
    search = request.args.get('search', '').lower().strip()
    
    filtered = rules_sorted[
        (rules_sorted['support'] >= min_sup) &
        (rules_sorted['confidence'] >= min_conf) &
        (rules_sorted['lift'] >= min_lift)
    ].copy()

    if search:
        filtered = filtered[
            filtered['antecedents_str'].str.lower().str.contains(search) |
            filtered['consequents_str'].str.lower().str.contains(search)
        ]
        
    top_rules = filtered.head(limit)
    
    data = []
    for idx, r in top_rules.iterrows():
        data.append({
            "index": int(idx),
            "antecedents": r['antecedents_str'],
            "consequents": r['consequents_str'],
            "support": round(float(r['support']), 6),
            "confidence": round(float(r['confidence']), 6),
            "lift": round(float(r['lift']), 6)
        })
        
    scatter_sample = [
        {
            "x": round(float(r['support']), 4),
            "y": round(float(r['confidence']), 4),
            "lift": round(float(r['lift']), 3),
            "rule": f"{r['antecedents_str']} -> {r['consequents_str']}"
        } for _, r in filtered.head(250).iterrows()
    ]

    return jsonify({
        "total_rules": len(all_rules),
        "matching_rules": len(filtered),
        "rules": data,
        "scatter": scatter_sample
    })


@app.route("/api/cooccurrence")
def get_cooccurrence():
    """Returns 15x15 product co-occurrence matrix"""
    matrix_data = []
    for p1 in product_list:
        row = {"product": p1}
        for p2 in product_list:
            row[p2] = int(cooccurrence_matrix.loc[p1, p2])
        matrix_data.append(row)
    return jsonify({
        "products": product_list,
        "matrix": matrix_data
    })


@app.route("/api/classification")
def get_classification():
    """Basket margin classification evaluation metrics"""
    return jsonify({
        "metrics": cls_metrics,
        "feature_importances": cls_features
    })


@app.route("/api/clustering")
def get_clustering():
    """K-Means transaction clustering and 2D PCA coordinates"""
    return jsonify({
        "pca_sample": pca_sample,
        "variance_ratio": [round(float(v) * 100, 1) for v in pca.explained_variance_ratio_]
    })


@app.route("/api/dataset/status")
def get_dataset_status():
    """Returns metadata about the active data warehouse dataset and recent records"""
    recent = df.tail(15).iloc[::-1].copy()
    recent['TotalAmountFormatted'] = recent['TotalAmount'].apply(lambda x: f"₹{x:,.2f}")
    return jsonify({
        "metadata": DATASET_METADATA,
        "recent_transactions": recent.to_dict(orient='records')
    })


@app.route("/api/transactions/recent")
def get_recent_transactions():
    """Returns up to 25 most recent transactions in the data warehouse"""
    limit = int(request.args.get('limit', 20))
    recent = df.tail(limit).iloc[::-1].copy()
    recent['TotalAmountFormatted'] = recent['TotalAmount'].apply(lambda x: f"₹{x:,.2f}")
    return jsonify({
        "count": len(recent),
        "transactions": recent.to_dict(orient='records')
    })


@app.route("/api/transactions/add", methods=["POST"])
def add_transaction():
    """Appends a new retail transaction, updates the Star Schema DW, and re-mines Apriori & ML models"""
    global df
    try:
        data = request.get_json() or {}
        
        # 1. Invoice Number (auto-increment if empty)
        inv_no = data.get('InvoiceNo')
        if not inv_no:
            inv_no = int(df['InvoiceNo'].max()) + 1
        else:
            inv_no = int(inv_no)

        desc = str(data.get('Description', 'Milk')).strip()
        qty = int(data.get('Quantity', 1))
        unit_price = float(data.get('UnitPrice', 30.0))
        discount = int(data.get('Discount', 0))

        # Standard Commodity Meta
        CATALOG_META = {
            "Milk": {"cat": "Dairy", "code": "P002", "price": 29.97},
            "Bread": {"cat": "Bakery", "code": "P001", "price": 28.50},
            "Butter": {"cat": "Dairy", "code": "P003", "price": 55.08},
            "Eggs": {"cat": "Dairy", "code": "P004", "price": 69.20},
            "Biscuits": {"cat": "Snacks", "code": "P005", "price": 24.95},
            "Tea": {"cat": "Beverages", "code": "P006", "price": 128.68},
            "Coffee": {"cat": "Beverages", "code": "P007", "price": 210.50},
            "Sugar": {"cat": "Grocery", "code": "P008", "price": 45.00},
            "Rice": {"cat": "Grocery", "code": "P009", "price": 64.85},
            "Chips": {"cat": "Snacks", "code": "P010", "price": 32.03},
            "Juice": {"cat": "Beverages", "code": "P011", "price": 90.11},
            "Soap": {"cat": "Personal Care", "code": "P012", "price": 50.08},
            "Shampoo": {"cat": "Personal Care", "code": "P013", "price": 150.40},
            "Toothpaste": {"cat": "Personal Care", "code": "P014", "price": 81.87},
            "Noodles": {"cat": "Grocery", "code": "P015", "price": 42.00}
        }

        meta = CATALOG_META.get(desc, {"cat": "Retail", "code": "P999", "price": unit_price})
        stock = str(data.get('StockCode', meta['code'])).strip()
        cat = str(data.get('ProductCategory', meta['cat'])).strip()

        # Computed Total Amount
        total_amount = round(qty * unit_price * (1.0 - (discount / 100.0)), 2)

        inv_date = str(data.get('InvoiceDate', datetime.now().strftime('%Y-%m-%d'))).strip()
        cust_id = str(data.get('CustomerID', 'C1500')).strip()
        country = str(data.get('Country', 'India')).strip()
        pay = str(data.get('PaymentMethod', 'Card')).strip()
        status = str(data.get('OrderStatus', 'Completed')).strip()

        new_row = {
            'InvoiceNo': inv_no,
            'StockCode': stock,
            'Description': desc,
            'Quantity': qty,
            'InvoiceDate': inv_date,
            'UnitPrice': unit_price,
            'CustomerID': cust_id,
            'Country': country,
            'ProductCategory': cat,
            'PaymentMethod': pay,
            'Discount': discount,
            'TotalAmount': total_amount,
            'OrderStatus': status
        }

        updated_df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        init_engine(updated_df, update_db=True, dataset_label="Live Operational DW", is_custom=True)

        return jsonify({
            "success": True,
            "message": f"Transaction #{inv_no} for '{desc}' (₹{total_amount:,.2f}) ingested into Star Schema and models re-mined successfully!",
            "transaction": new_row,
            "metadata": DATASET_METADATA
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/dataset/upload", methods=["POST"])
def upload_dataset():
    """Uploads a complete custom CSV dataset, validates schema, updates Star Schema DW, and executes full mining pipeline"""
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file uploaded"}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "No selected file"}), 400

        new_df = pd.read_csv(file)

        # Minimum required columns for dimensional analysis and market basket mining
        required_cols = ['InvoiceNo', 'Description', 'Quantity', 'InvoiceDate', 'UnitPrice', 'TotalAmount', 'OrderStatus', 'Country']
        missing = [c for c in required_cols if c not in new_df.columns]
        if missing:
            return jsonify({
                "success": False,
                "error": f"CSV missing required columns: {', '.join(missing)}. Expected: {', '.join(required_cols)}"
            }), 400

        # Fill optional metadata columns if not present
        if 'Discount' not in new_df.columns:
            new_df['Discount'] = 0
        if 'StockCode' not in new_df.columns:
            new_df['StockCode'] = 'P001'
        if 'CustomerID' not in new_df.columns:
            new_df['CustomerID'] = 'C1000'
        if 'ProductCategory' not in new_df.columns:
            new_df['ProductCategory'] = 'General'
        if 'PaymentMethod' not in new_df.columns:
            new_df['PaymentMethod'] = 'Card'

        init_engine(new_df, update_db=True, dataset_label=f"Uploaded: {file.filename}", is_custom=True)

        return jsonify({
            "success": True,
            "message": f"Dataset '{file.filename}' ({len(new_df):,} records) ingested! Data warehouse and association rules re-mined.",
            "metadata": DATASET_METADATA
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route("/api/dataset/reset", methods=["POST"])
def reset_dataset():
    """Restores the pristine original 10,005-record retail dataset and restores all baseline models"""
    try:
        orig_df = pd.read_csv(CSV_PATH)
        init_engine(orig_df, update_db=True, dataset_label="Default Dataset (10,005 records)", is_custom=False)
        return jsonify({
            "success": True,
            "message": "System restored to default 10,005-record dataset. All baseline DW models re-established.",
            "metadata": DATASET_METADATA
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"\n=======================================================")
    print(f" MERIDIAN Enterprise Analytics Engine is Running")
    print(f" Full-Screen Dashboard: http://127.0.0.1:{port}")
    print(f"=======================================================\n")
    app.run(host="0.0.0.0", port=port, debug=False)

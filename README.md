# MERIDIAN | Enterprise Retail Data Mining & Analytics Suite
**Lead:** Patel Manish Kumar  
**Domain:** Full-Screen Retail Intelligence, Dynamic Graph Studio, Dimensional Modeling, Market Basket Mining  

---

## 🚀 Live Dashboard URL
```bash
http://127.0.0.1:8080
```

To run or restart the server:
```bash
cd /Users/patelmanishkumar/dw
./run_dashboard.sh
```

---

## 🌟 Key Capabilities & Features

### 1. Full-Screen Edge-to-Edge Canvas
- Expansive full-width layout (`max-w-[1920px]`) built for modern high-resolution displays.
- High-density KPI strip featuring real-time gross revenue, net sales, cancellation rates, multi-item baskets, active rules, and commodity counts.
- Global Interactive Filter Strip (Year, Country Territory, Order Status) dynamically propagating to all dashboard modules simultaneously.

### 2. User-Chooseable Dynamic Graph Studio
- **Customizable Statistical Analytics:**
  - **Dimension (X-Axis):** Department, Commodity, Market Territory, Payment Method, Order Status, Calendar Year, Monthly Trajectory.
  - **Metric (Y-Axis):** Total Sales ($), Units Sold (Qty), Promotional Discount (%), Commodity Price ($).
  - **Aggregation Method:** Sum (Total Aggregate), Mean (Average per Order), Count (Transaction Volume).
  - **Chart Visualizations:** Bar Chart, Smooth Area Curve, Donut Chart, Polar Area, Radar.
  - **Sorting:** Descending, Ascending, Domain Sequence.
- **Statistical Intelligence Cards:** Instant readouts for Sum Aggregate, Mean per Partition, Peak Category Leader, and Peak Sales Value.

### 3. Multi-Variate Statistical Presets
- 36-Month Longitudinal Sales Trajectory (Fulfilled vs. Cancelled Trends).
- Departmental Volume & Revenue Share (Donut chart with custom badges).
- Basket Size Quantity Distribution Histogram (Items per Order).
- Order Spending Interval Distribution Histogram ($0–$50 up to $750+).

### 4. Dimensional Data Warehouse & OLAP Studio
- **Star Schema Physical Design:** `FACT_Sales` ($10,005$ records) surrounded by `DIM_Time`, `DIM_Product`, `DIM_Customer`, and `DIM_Country` in SQLite (`Product_Recommendation_DW.db`).
- **The 5 Core OLAP Operations (Shows Python code + interactive results):**
  1. **Roll-up:** `df.groupby('Year')['TotalAmount'].sum().reset_index()`
  2. **Drill-down:** `df[df['Year'] == 2020].groupby(['Year', 'Month'])['TotalAmount'].sum().reset_index()`
  3. **Pivot:** `pd.pivot_table(df, values='TotalAmount', index='Year', columns='OrderStatus', aggfunc='sum')`
  4. **Slice:** `df[df['OrderStatus'] == 'Completed']`
  5. **Dice:** `df[(df['OrderStatus'] == 'Completed') & (df['TotalAmount'] > 500)]`

### 5. Apriori Association Pattern Mining
- $2,092$ multi-item baskets across $15$ commodities.
- $363$ frequent itemsets (`min_support = 0.005`) & $942$ association rules (`min_confidence = 0.05`).
- Interactive Parameter Sliders: Min Support, Min Confidence, Min Lift, and Search Keyword.
- Academic Support vs. Confidence Scatter Plot colored by Lift magnitude.
- 15&times;15 Pairwise Basket Co-occurrence Affinity Heatmap.

### 6. Interactive Basket Simulator & Recommender Engine
- Interactive commodity selection grid.
- Active cart simulator.
- Executes the project's exact `recommend_products(product_name, rules, top_n=5)` function.
- Outputs the exact result:
  `Recommendations for Milk: ['Butter', 'Bread', 'Toothpaste', 'Tea', 'Soap']` with lift ratios and attachment cards.

### 7. Advanced Machine Learning Modules (Syllabus Rubric)
- Supervised Random Forest Margin Classifier ($90.6\%$ Accuracy, $0.978$ ROC-AUC, Gini feature importance).
- Unsupervised K-Means Shopper Segmentation ($k=4$ with 2D PCA spatial cluster map).

---

### 8. Data Ingestion & Live Transaction Management (DWDM Ingestion Pipeline)
- **Live Transaction Entry Form:** Allows operational ingestion of individual retail transactions (`InvoiceNo`, `Date`, `Product`, `Quantity`, `UnitPrice ₹`, `Discount %`, `TotalAmount ₹`, `Country`, `Customer`, `Payment`, `OrderStatus`).
- **Dynamic Star Schema Update:** Directly inserts rows into SQLite (`Sales_Fact`) and synchronizes dimensional hierarchies (`Product_Dim`, `Customer_Dim`, `Time_Dim`, `Country_Dim`).
- **Real-Time Model Re-Mining:** Instantly re-mines Apriori frequent itemsets, updates association rules, and refreshes the recommendation engine.
- **Bulk CSV Ingestion:** Drag-and-drop ingestion of custom `.csv` datasets with automated schema validation.
- **Operations on Recommended Products for Updated Set:** Live recommendation tester dedicated to evaluating the real-time impact of newly committed transactions on cross-selling rules.
- **Fail-Safe Revoke & Reset Mechanism:**
  - One-click **"Reset to Default Dataset"** in the UI to instantly revert to the pristine original 10,005-record baseline.
  - Complete byte-for-byte stable backup stored in `/Users/patelmanishkumar/dw/backup_stable/` for instantaneous manual rollback.

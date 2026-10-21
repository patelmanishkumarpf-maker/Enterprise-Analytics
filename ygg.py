from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import pandas as pd

# Split dataset into training (75%) and testing (25%)
X_train, X_test, y_train, y_test = train_test_split(
    X_encoded, y_cls, test_size=0.25, random_state=42
)

# Initialize and train the Random Forest Classifier
model = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42)
model.fit(X_train, y_train)

print("Random Forest Margin Classifier trained successfully")

# Predict margin status for test records
y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

# Compare actual vs predicted margin classifications
results = pd.DataFrame({
    'Actual Margin': y_test.values,
    'Predicted Margin': y_pred,
    'Confidence Prob': y_prob.round(4)
})

display(results.head(10))
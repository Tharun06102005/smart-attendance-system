"""
Test Script: Train Risk Prediction Model and Show Accuracy
Trains Model 2 (Risk Prediction) with 1500 samples and displays accuracy metrics
"""

import numpy as np
import pandas as pd
import pickle
import json
import sys
import os
from datetime import datetime, timedelta
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import subprocess

# Add server/ml to path
sys.path.append('server/ml')

from model1_trend_analysis import calculate_trend_analysis
from model3_consistency_analysis import calculate_consistency_analysis
from model4_attentiveness_analysis import analyze_attentiveness
from model2_risk_prediction import extract_features

# Configuration
N_SAMPLES = 1500
RANDOM_SEED = 42
MODEL_PATH = 'server/ml/risk_prediction_model_test.pkl'

print("="*80)
print("TRAINING RISK PREDICTION MODEL WITH 1500 SAMPLES")
print("="*80)

def generate_attendance_records(student_type, total_sessions):
    """Generate realistic attendance records"""
    records = []
    current_date = datetime(2024, 1, 1)
    
    # Define patterns
    patterns = {
        'excellent': {'present_prob': 0.95, 'high_att': 0.7, 'positive_emo': 0.6},
        'good': {'present_prob': 0.85, 'high_att': 0.5, 'positive_emo': 0.5},
        'average': {'present_prob': 0.78, 'high_att': 0.3, 'positive_emo': 0.4},
        'at_risk': {'present_prob': 0.72, 'high_att': 0.2, 'positive_emo': 0.3},
        'failing': {'present_prob': 0.60, 'high_att': 0.1, 'positive_emo': 0.2}
    }
    
    pattern = patterns[student_type]
    
    for i in range(total_sessions):
        is_present = np.random.random() < pattern['present_prob']
        
        if is_present:
            att_rand = np.random.random()
            attentiveness = 'High' if att_rand < pattern['high_att'] else ('Medium' if att_rand < pattern['high_att'] + 0.4 else 'Low')
            
            emo_rand = np.random.random()
            emotion = np.random.choice(['happy', 'surprise']) if emo_rand < pattern['positive_emo'] else ('neutral' if emo_rand < pattern['positive_emo'] + 0.3 else np.random.choice(['sad', 'angry']))
        else:
            attentiveness = None
            emotion = None
        
        reason_type = None
        if not is_present and np.random.random() < 0.3:
            reason_type = np.random.choice(['Medical', 'Family Emergency'])
        
        records.append({
            'status': 'present' if is_present else 'absent',
            'session_date': current_date.strftime('%Y-%m-%d'),
            'reason_type': reason_type,
            'attentiveness': attentiveness,
            'emotion': emotion
        })
        
        current_date += timedelta(days=int(np.random.choice([2, 3, 4])))
    
    return records

def generate_class_data(avg_attendance, total_students=50, total_sessions=20):
    """Generate class data for peer comparison"""
    students = []
    sessions = {}
    
    for i in range(total_students):
        variance = (np.random.random() - 0.5) * 20
        student_attendance = np.clip(avg_attendance + variance, 50, 100)
        present_count = int((student_attendance / 100) * total_sessions)
        
        records = []
        current_date = datetime(2024, 1, 1)
        for j in range(total_sessions):
            records.append({
                'status': 'present' if j < present_count else 'absent',
                'session_date': current_date.strftime('%Y-%m-%d')
            })
            current_date += timedelta(days=int(np.random.choice([2, 3, 4])))
        
        students.append({'id': i + 1, 'records': records})
    
    current_date = datetime(2024, 1, 1)
    for i in range(total_sessions):
        date = current_date.strftime('%Y-%m-%d')
        present_count = int((avg_attendance / 100) * total_students) + np.random.randint(-5, 6)
        sessions[date] = {
            'total_students': total_students,
            'present_count': present_count,
            'absent_count': total_students - present_count
        }
        current_date += timedelta(days=int(np.random.choice([2, 3, 4])))
    
    return {'students': students, 'sessions': sessions}

def generate_training_sample(student_type):
    """Generate one training sample"""
    total_sessions = np.random.randint(20, 40)
    student_data = generate_attendance_records(student_type, total_sessions)
    
    # Run models
    model1_result = calculate_trend_analysis(student_data)
    model3_result = calculate_consistency_analysis(student_data)
    consistency_from_model3 = model3_result.get('consistency', 'regular')
    model4_result = analyze_attentiveness(student_data, consistency_from_model3)
    
    class_avg = np.random.uniform(75, 85)
    class_data = generate_class_data(class_avg, total_students=50, total_sessions=total_sessions)
    
    features = extract_features(student_data, model1_result, model3_result, model4_result, class_data, total_sessions_planned=50)
    
    current_attendance = features[0]
    recovery_possible = features[34]
    
    if current_attendance >= 85:
        risk_label = 'low'
    elif current_attendance >= 75:
        risk_label = 'moderate' if recovery_possible == 1 else 'high'
    else:
        risk_label = 'high' if recovery_possible == 1 and current_attendance >= 70 else 'high'
    
    return features, risk_label

print("\n[1/4] Generating 1500 training samples...")

X = []
y = []

student_distribution = {
    'excellent': int(N_SAMPLES * 0.30),
    'good': int(N_SAMPLES * 0.25),
    'average': int(N_SAMPLES * 0.20),
    'at_risk': int(N_SAMPLES * 0.15),
    'failing': int(N_SAMPLES * 0.10)
}

sample_count = 0
for student_type, count in student_distribution.items():
    print(f"  Generating {count} samples for '{student_type}' students...")
    for i in range(count):
        try:
            features, risk_label = generate_training_sample(student_type)
            X.append(features)
            y.append(risk_label)
            sample_count += 1
            if sample_count % 100 == 0:
                print(f"    Progress: {sample_count}/{N_SAMPLES}")
        except Exception as e:
            continue

print(f"\n✅ Generated {len(X)} samples with 45 features")

print("\n[2/4] Splitting data (80% train, 20% test)...")
X_train, X_test, y_train, y_test = train_test_split(
    np.array(X), np.array(y), test_size=0.2, random_state=RANDOM_SEED, stratify=y
)

print(f"  Training set: {len(X_train)} samples")
print(f"  Test set: {len(X_test)} samples")

print("\n[3/4] Training Gradient Boosting model...")
model = GradientBoostingClassifier(
    n_estimators=300,
    max_depth=10,
    learning_rate=0.1,
    random_state=RANDOM_SEED
)

model.fit(X_train, y_train)
print("  ✅ Model trained!")

print("\n[4/4] Evaluating model...")
train_pred = model.predict(X_train)
test_pred = model.predict(X_test)

train_accuracy = accuracy_score(y_train, train_pred)
test_accuracy = accuracy_score(y_test, test_pred)

print("\n" + "="*80)
print("TRAINING RESULTS")
print("="*80)
print(f"\n📊 ACCURACY METRICS:")
print(f"   Training Accuracy: {train_accuracy * 100:.2f}%")
print(f"   Test Accuracy: {test_accuracy * 100:.2f}%")
print(f"   Samples Used: {len(X)}")

print(f"\n📊 DETAILED CLASSIFICATION REPORT:")
print(classification_report(y_test, test_pred, target_names=['high', 'low', 'moderate']))

print(f"\n📊 CONFUSION MATRIX:")
cm = confusion_matrix(y_test, test_pred, labels=['high', 'low', 'moderate'])
print("              Predicted")
print("              high  low  moderate")
print(f"Actual high     {cm[0][0]:4d} {cm[0][1]:4d}     {cm[0][2]:4d}")
print(f"       low      {cm[1][0]:4d} {cm[1][1]:4d}     {cm[1][2]:4d}")
print(f"       moderate {cm[2][0]:4d} {cm[2][1]:4d}     {cm[2][2]:4d}")

# Save model
model_data = {
    'model': model,
    'feature_names': ['feature_' + str(i) for i in range(45)],
    'train_accuracy': train_accuracy,
    'test_accuracy': test_accuracy,
    'n_samples': len(X)
}

with open(MODEL_PATH, 'wb') as f:
    pickle.dump(model_data, f)

print(f"\n✅ Model saved to: {MODEL_PATH}")
print("\n" + "="*80)
print(f"✅ TRAINING COMPLETE! Test Accuracy: {test_accuracy * 100:.2f}%")
print("="*80)

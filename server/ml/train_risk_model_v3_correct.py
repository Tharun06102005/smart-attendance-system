"""
Training Script for Model 2: Risk Prediction - CORRECT VERSION (v3)
This version uses ACTUAL outputs from Models 1, 3, and 4

Flow:
1. Generate realistic attendance records (status, date, reason_type, attentiveness, emotion)
2. Call Model 1 → get trend result
3. Call Model 3 → get consistency result
4. Call Model 4 → get attentiveness result
5. Generate class data
6. Model 2 extracts 45 features from all above
7. Label the risk (low/moderate/high)
8. Train the model
"""

import numpy as np
import pandas as pd
import pickle
import json
import sys
import os
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Add parent directory to path to import models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the actual ML models
from model1_trend_analysis import calculate_trend_analysis
from model3_consistency_analysis import calculate_consistency_analysis
from model4_attentiveness_analysis import analyze_attentiveness

# Import Model 2's feature extraction function
from model2_risk_prediction import extract_features

# ============================================================================
# CONFIGURATION
# ============================================================================

N_SAMPLES = 5000  # 5000 samples - good balance between coverage and training time
RANDOM_SEED = 42
MODEL_PATH = 'server/ml/risk_prediction_model.pkl'
TRAINING_DATA_CSV = 'server/ml/training_data_risk_model.csv'

print("="*80)
print("MODEL 2: RISK PREDICTION - CORRECT TRAINING (v3)")
print("Using ACTUAL outputs from Models 1, 3, and 4")
print("="*80)

# ============================================================================
# GENERATE REALISTIC ATTENDANCE RECORDS
# ============================================================================

def generate_attendance_records(student_type, total_sessions, start_date='2024-01-01'):
    """
    Generate realistic attendance records matching the database structure
    
    Args:
        student_type: 'excellent', 'good', 'average', 'at_risk', 'failing'
        total_sessions: Number of sessions to generate
        start_date: Starting date for sessions
    
    Returns:
        List of attendance records with proper structure
    """
    records = []
    current_date = datetime.strptime(start_date, '%Y-%m-%d')
    
    # Define attendance patterns based on student type
    if student_type == 'excellent':
        present_prob = 0.95
        high_att_prob = 0.7
        positive_emotion_prob = 0.6
    elif student_type == 'good':
        present_prob = 0.85
        high_att_prob = 0.5
        positive_emotion_prob = 0.5
    elif student_type == 'average':
        present_prob = 0.78
        high_att_prob = 0.3
        positive_emotion_prob = 0.4
    elif student_type == 'at_risk':
        present_prob = 0.72
        high_att_prob = 0.2
        positive_emotion_prob = 0.3
    else:  # failing
        present_prob = 0.60
        high_att_prob = 0.1
        positive_emotion_prob = 0.2
    
    for i in range(total_sessions):
        # Determine if present or absent
        is_present = np.random.random() < present_prob
        
        # Determine attentiveness (only for present)
        if is_present:
            att_rand = np.random.random()
            if att_rand < high_att_prob:
                attentiveness = 'High'
            elif att_rand < high_att_prob + 0.4:
                attentiveness = 'Medium'
            else:
                attentiveness = 'Low'
            
            # Determine emotion
            emo_rand = np.random.random()
            if emo_rand < positive_emotion_prob:
                emotion = np.random.choice(['happy', 'surprise'])
            elif emo_rand < positive_emotion_prob + 0.3:
                emotion = 'neutral'
            else:
                emotion = np.random.choice(['sad', 'angry', 'fear', 'disgust'])
        else:
            attentiveness = None
            emotion = None
        
        # Determine reason_type for absences
        reason_type = None
        if not is_present:
            # 30% chance of having a valid reason
            if np.random.random() < 0.3:
                reason_type = np.random.choice(['Medical', 'Family Emergency', 'Official Duty'])
        
        record = {
            'status': 'present' if is_present else 'absent',
            'session_date': current_date.strftime('%Y-%m-%d'),
            'reason_type': reason_type,
            'attentiveness': attentiveness,
            'emotion': emotion
        }
        
        records.append(record)
        
        # Move to next session (typically 2-3 days apart)
        current_date += timedelta(days=int(np.random.choice([2, 3, 4])))
    
    return records


def generate_class_data(avg_attendance, total_students=50, total_sessions=20):
    """
    Generate class-level data for peer comparison
    """
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
    
    # Generate session-level data
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


# ============================================================================
# GENERATE TRAINING DATA USING ACTUAL MODELS
# ============================================================================

def generate_training_sample(student_type, difficulty='medium'):
    """
    Generate ONE training sample by:
    1. Creating attendance records
    2. Running Models 1, 3, 4
    3. Extracting 45 features
    4. Labeling risk
    
    Returns:
        Tuple of (features, risk_label, student_type, difficulty, metadata)
        metadata includes: model outputs, attendance summary, etc.
    """
    # Determine number of sessions based on difficulty
    if difficulty == 'easy':
        total_sessions = np.random.randint(15, 25)
    elif difficulty == 'medium':
        total_sessions = np.random.randint(20, 35)
    elif difficulty == 'hard':
        total_sessions = np.random.randint(30, 45)
    else:  # very_hard
        total_sessions = np.random.randint(35, 48)
    
    # Generate attendance records
    student_data = generate_attendance_records(student_type, total_sessions)
    
    # Run Model 1 (Trend Analysis)
    model1_result = calculate_trend_analysis(student_data)
    
    # Run Model 3 (Consistency Analysis)
    model3_result = calculate_consistency_analysis(student_data)
    
    # Run Model 4 (Attentiveness Analysis)
    # Model 4 expects: analyze_attentiveness(attendance_data, consistency_from_model3)
    consistency_from_model3 = model3_result.get('consistency', 'regular')
    model4_result = analyze_attentiveness(student_data, consistency_from_model3)
    
    # Generate class data
    if student_type in ['excellent', 'good']:
        class_avg = np.random.uniform(78, 88)
    else:
        class_avg = np.random.uniform(75, 85)
    
    class_data = generate_class_data(class_avg, total_students=50, total_sessions=total_sessions)
    
    # Extract 45 features using Model 2's function
    features = extract_features(
        student_data,
        model1_result,
        model3_result,
        model4_result,
        class_data,
        total_sessions_planned=50
    )
    
    # Determine risk label based on current attendance and recovery possibility
    current_attendance = features[0]  # First feature is current_attendance_percentage
    recovery_possible = features[34]  # recovery_possible feature
    
    if current_attendance >= 85:
        risk_label = 'low'
    elif current_attendance >= 75:
        if recovery_possible == 1:
            risk_label = 'moderate'
        else:
            risk_label = 'high'
    else:
        if recovery_possible == 1 and current_attendance >= 70:
            risk_label = 'high'
        else:
            risk_label = 'high'
    
    # Calculate attendance summary
    present_count = sum(1 for r in student_data if r['status'] == 'present')
    absent_count = len(student_data) - present_count
    excused_count = sum(1 for r in student_data if r['status'] == 'absent' and r['reason_type'] is not None)
    
    # Metadata for CSV
    metadata = {
        'total_sessions': len(student_data),
        'present_count': present_count,
        'absent_count': absent_count,
        'excused_absences': excused_count,
        'unexcused_absences': absent_count - excused_count,
        'model1_trend': model1_result.get('trend', 'stable'),
        'model1_confidence': model1_result.get('confidence', 'none'),
        'model3_consistency': model3_result.get('consistency', 'regular'),
        'model3_confidence': model3_result.get('confidence', 'none'),
        'model4_attentiveness': model4_result.get('attentiveness', 'moderately_attentive'),
        'model4_confidence': model4_result.get('confidence', 'none')
    }
    
    return features, risk_label, student_type, difficulty, metadata


print("\n[1/6] Generating training data using ACTUAL Models 1, 3, 4...")
print("This will take longer as we're running real model calculations...")

X = []
y = []
student_types_list = []
difficulty_levels_list = []
metadata_list = []

# Distribution
student_distribution = {
    'excellent': int(N_SAMPLES * 0.30),
    'good': int(N_SAMPLES * 0.25),
    'average': int(N_SAMPLES * 0.20),
    'at_risk': int(N_SAMPLES * 0.15),
    'failing': int(N_SAMPLES * 0.10)
}

difficulty_distribution = ['easy', 'medium', 'hard', 'very_hard']
difficulty_weights = [0.30, 0.35, 0.25, 0.10]

print(f"Student Distribution: {student_distribution}")
print(f"Difficulty Levels: {dict(zip(difficulty_distribution, difficulty_weights))}")

sample_count = 0
for student_type, count in student_distribution.items():
    print(f"\nGenerating {count} samples for '{student_type}' students...")
    for i in range(count):
        difficulty = np.random.choice(difficulty_distribution, p=difficulty_weights)
        
        try:
            features, risk_label, s_type, diff, metadata = generate_training_sample(student_type, difficulty)
            X.append(features)
            y.append(risk_label)
            student_types_list.append(s_type)
            difficulty_levels_list.append(diff)
            metadata_list.append(metadata)
            
            sample_count += 1
            if sample_count % 100 == 0:
                print(f"  Progress: {sample_count}/{N_SAMPLES} samples generated...")
        except Exception as e:
            print(f"  Warning: Failed to generate sample {i+1}: {str(e)[:100]}")
            continue

print(f"\n✅ Generated {len(X)} samples with 45 features")

# Save to CSV with comprehensive format
print("\n[2/6] Saving training data to CSV with comprehensive format...")

FEATURE_NAMES = [
    'current_attendance_percentage', 'total_sessions_so_far', 'present_count', 'absent_count',
    'excused_absence_count', 'unexcused_absence_count', 'attendance_variance',
    'trend_direction', 'trend_strength', 'recent_5_attendance_rate', 'recent_10_attendance_rate',
    'trend_slope', 'trend_acceleration', 'recent_vs_overall_diff',
    'consistency_score', 'consecutive_absences_max', 'consecutive_absences_avg',
    'absence_clustering_score', 'attendance_regularity', 'absence_frequency', 'attendance_stability',
    'attentiveness_level', 'average_attentiveness_score', 'positive_emotion_ratio',
    'engagement_trend', 'attentiveness_consistency',
    'semester_progress', 'sessions_remaining', 'weeks_since_enrollment', 'time_pressure', 'semester_phase',
    'total_sessions_planned', 'sessions_remaining_duplicate', 'best_possible_attendance',
    'recovery_possible', 'sessions_needed_to_reach_75', 'recovery_difficulty',
    'recovery_margin', 'failure_certainty',
    'class_average_attendance', 'student_vs_class_difference', 'class_attendance_on_absent_days',
    'peer_rank_percentile', 'below_class_average', 'relative_performance_trend'
]

# Create DataFrame with features
df = pd.DataFrame(X, columns=FEATURE_NAMES)

# Add INPUT metadata (what was passed to models)
df['input_total_sessions'] = [m['total_sessions'] for m in metadata_list]
df['input_present_count'] = [m['present_count'] for m in metadata_list]
df['input_absent_count'] = [m['absent_count'] for m in metadata_list]
df['input_excused_absences'] = [m['excused_absences'] for m in metadata_list]
df['input_unexcused_absences'] = [m['unexcused_absences'] for m in metadata_list]

# Add MODEL OUTPUTS (what Models 1, 3, 4 returned)
df['model1_output_trend'] = [m['model1_trend'] for m in metadata_list]
df['model1_output_confidence'] = [m['model1_confidence'] for m in metadata_list]
df['model3_output_consistency'] = [m['model3_consistency'] for m in metadata_list]
df['model3_output_confidence'] = [m['model3_confidence'] for m in metadata_list]
df['model4_output_attentiveness'] = [m['model4_attentiveness'] for m in metadata_list]
df['model4_output_confidence'] = [m['model4_confidence'] for m in metadata_list]

# Add TARGET and metadata
df['risk_label'] = y
df['student_type'] = student_types_list
df['difficulty_level'] = difficulty_levels_list

os.makedirs(os.path.dirname(TRAINING_DATA_CSV), exist_ok=True)
df.to_csv(TRAINING_DATA_CSV, index=False)

print(f"✅ Training data saved to: {TRAINING_DATA_CSV}")
print(f"   Total rows: {len(df)}")
print(f"   Total columns: {len(df.columns)}")
print(f"\n📋 CSV Structure:")
print(f"   - 45 extracted features (from Models 1, 3, 4 outputs)")
print(f"   - 5 input metadata columns (sessions, present, absent, etc.)")
print(f"   - 6 model output columns (trend, consistency, attentiveness + confidence)")
print(f"   - 3 target/metadata columns (risk_label, student_type, difficulty)")
print(f"   Total: {len(df.columns)} columns")
print(f"\n📊 Sample of first 3 rows:")
print(df[['input_total_sessions', 'input_present_count', 'model1_output_trend', 
          'model3_output_consistency', 'model4_output_attentiveness', 'risk_label']].head(3).to_string())

# Continue with training...
print("\n[3/6] Splitting data...")
X_train, X_test, y_train, y_test = train_test_split(
    np.array(X), np.array(y), test_size=0.2, random_state=RANDOM_SEED, stratify=y
)

print(f"✅ Training set: {len(X_train)} samples")
print(f"✅ Test set: {len(X_test)} samples")

print("\n[4/6] Training Gradient Boosting model...")
model = GradientBoostingClassifier(
    n_estimators=300,
    max_depth=10,
    learning_rate=0.1,
    min_samples_split=2,
    min_samples_leaf=1,
    subsample=0.8,
    random_state=RANDOM_SEED,
    max_features='sqrt'
)

model.fit(X_train, y_train)
print("✅ Model trained!")

print("\n[5/6] Evaluating...")
train_pred = model.predict(X_train)
test_pred = model.predict(X_test)

train_accuracy = accuracy_score(y_train, train_pred)
test_accuracy = accuracy_score(y_test, test_pred)

print(f"\n📊 ACCURACY:")
print(f"   Training: {train_accuracy * 100:.2f}%")
print(f"   Test: {test_accuracy * 100:.2f}%")

print(f"\n📊 CLASSIFICATION REPORT:")
print(classification_report(y_test, test_pred))

print("\n[6/6] Saving model...")
model_data = {
    'model': model,
    'feature_names': FEATURE_NAMES,
    'train_accuracy': train_accuracy,
    'test_accuracy': test_accuracy,
    'n_samples': len(X),
    'n_features': len(FEATURE_NAMES)
}

with open(MODEL_PATH, 'wb') as f:
    pickle.dump(model_data, f)

print(f"✅ Model saved to: {MODEL_PATH}")
print("\n" + "="*80)
print("✅ TRAINING COMPLETE!")
print(f"Test Accuracy: {test_accuracy * 100:.2f}%")
print("="*80)

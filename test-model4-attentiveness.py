"""
Test Script for Model 4: Attentiveness Analysis
Tests the attentiveness analysis model with various engagement patterns
"""

import sys
import json
from datetime import datetime, timedelta

sys.path.append('server/ml')
from model4_attentiveness_analysis import analyze_attentiveness

print("="*80)
print("MODEL 4: ATTENTIVENESS ANALYSIS TEST")
print("="*80)

def generate_test_data(pattern_type, num_sessions=20):
    """Generate test attendance data with specific attentiveness patterns"""
    records = []
    current_date = datetime(2024, 1, 1)
    
    for i in range(num_sessions):
        is_present = i % 4 != 0  # 75% attendance
        
        if is_present:
            if pattern_type == 'actively_attentive':
                attentiveness = 'High' if i % 3 != 0 else 'Medium'
                emotion = 'happy' if i % 2 == 0 else 'surprise'
            elif pattern_type == 'moderately_attentive':
                attentiveness = 'Medium' if i % 2 == 0 else 'Low'
                emotion = 'neutral' if i % 2 == 0 else 'happy'
            elif pattern_type == 'passively_attentive':
                attentiveness = 'Low' if i % 3 != 0 else 'Medium'
                emotion = 'sad' if i % 2 == 0 else 'neutral'
            else:  # mixed
                attentiveness = ['High', 'Medium', 'Low'][i % 3]
                emotion = ['happy', 'neutral', 'sad'][i % 3]
        else:
            attentiveness = None
            emotion = None
        
        records.append({
            'status': 'present' if is_present else 'absent',
            'session_date': current_date.strftime('%Y-%m-%d'),
            'attentiveness': attentiveness,
            'emotion': emotion
        })
        current_date += timedelta(days=3)
    
    return records

# Test cases
test_cases = [
    ('actively_attentive', 20, 'regular', 'Actively attentive with regular attendance'),
    ('moderately_attentive', 20, 'moderately_irregular', 'Moderately attentive with irregular attendance'),
    ('passively_attentive', 20, 'highly_irregular', 'Passively attentive with irregular attendance'),
    ('mixed', 20, 'regular', 'Mixed attentiveness with regular attendance'),
    ('actively_attentive', 5, 'regular', 'Early stage - actively attentive (5 sessions)'),
    ('moderately_attentive', 3, 'regular', 'Very early stage (3 sessions)'),
]

print("\nRunning test cases...\n")

for pattern, sessions, consistency, description in test_cases:
    print("-" * 80)
    print(f"TEST: {description}")
    print("-" * 80)
    
    data = generate_test_data(pattern, sessions)
    result = analyze_attentiveness(data, consistency)
    
    print(f"Pattern Type: {pattern}")
    print(f"Sessions: {sessions}")
    print(f"Consistency from Model 3: {consistency}")
    print(f"\nRESULTS:")
    print(f"  Attentiveness: {result.get('attentiveness', 'N/A')}")
    print(f"  Confidence: {result.get('confidence', 'N/A')}")
    print(f"  Status: {result.get('status', 'N/A')}")
    
    if 'face_score' in result:
        print(f"  Face Score: {result['face_score']:.3f}")
        print(f"  Consistency Checked: {result.get('consistency_checked', False)}")
    
    if 'features' in result:
        features = result['features']
        print(f"\nFeatures:")
        print(f"  Present Sessions: {features['total_present_sessions']}")
        print(f"  Data Quality: {features['data_quality_score']:.2f}")
        print(f"  High Attentiveness Ratio: {features['high_attentiveness_ratio']:.2f}")
        print(f"  Positive Emotion Ratio: {features['positive_emotion_ratio']:.2f}")
        print(f"  Average Attentiveness Score: {features['average_attentiveness_score']:.2f}")
    
    print(f"\nReason: {result.get('reason', 'N/A')}")
    print(f"Interpretation: {result.get('interpretation', 'N/A')}")
    
    print()

print("="*80)
print("✅ MODEL 4 TEST COMPLETE")
print("="*80)

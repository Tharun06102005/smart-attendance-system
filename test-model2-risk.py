"""
Test Script for Model 2: Risk Prediction
Tests the risk prediction model with various student scenarios
"""

import sys
import json
from datetime import datetime, timedelta
import numpy as np

sys.path.append('server/ml')
from model1_trend_analysis import calculate_trend_analysis
from model3_consistency_analysis import calculate_consistency_analysis
from model4_attentiveness_analysis import analyze_attentiveness
from model2_risk_prediction import analyze_risk

print("="*80)
print("MODEL 2: RISK PREDICTION TEST")
print("="*80)

def generate_test_data(scenario, num_sessions=25):
    """Generate test attendance data for different risk scenarios"""
    records = []
    current_date = datetime(2024, 1, 1)
    
    for i in range(num_sessions):
        if scenario == 'low_risk':
            # High attendance, good engagement
            is_present = i % 10 != 0  # 90% attendance
            attentiveness = 'High' if i % 2 == 0 else 'Medium'
            emotion = 'happy' if i % 2 == 0 else 'neutral'
            reason = 'Medical' if not is_present else None
        elif scenario == 'moderate_risk':
            # Borderline attendance, moderate engagement
            is_present = i % 4 != 0  # 75% attendance
            attentiveness = 'Medium' if i % 2 == 0 else 'Low'
            emotion = 'neutral' if i % 2 == 0 else 'sad'
            reason = None
        elif scenario == 'high_risk':
            # Low attendance, poor engagement
            is_present = i % 3 == 0  # 33% attendance
            attentiveness = 'Low' if i % 2 == 0 else 'Medium'
            emotion = 'sad' if i % 2 == 0 else 'neutral'
            reason = None
        else:  # recovering
            # Started bad, improving
            is_present = i > (num_sessions * 0.4) or (i % 5 == 0)
            attentiveness = 'High' if i > (num_sessions * 0.5) else 'Medium'
            emotion = 'happy' if i > (num_sessions * 0.5) else 'neutral'
            reason = 'Medical' if not is_present and i < (num_sessions * 0.4) else None
        
        if is_present:
            records.append({
                'status': 'present',
                'session_date': current_date.strftime('%Y-%m-%d'),
                'reason_type': None,
                'attentiveness': attentiveness,
                'emotion': emotion
            })
        else:
            records.append({
                'status': 'absent',
                'session_date': current_date.strftime('%Y-%m-%d'),
                'reason_type': reason,
                'attentiveness': None,
                'emotion': None
            })
        
        current_date += timedelta(days=3)
    
    return records

def generate_class_data(avg_attendance=80, total_students=50, total_sessions=25):
    """Generate mock class data"""
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
            current_date += timedelta(days=3)
        
        students.append({'id': i + 1, 'records': records})
    
    current_date = datetime(2024, 1, 1)
    for i in range(total_sessions):
        date = current_date.strftime('%Y-%m-%d')
        present_count = int((avg_attendance / 100) * total_students)
        sessions[date] = {
            'total_students': total_students,
            'present_count': present_count,
            'absent_count': total_students - present_count
        }
        current_date += timedelta(days=3)
    
    return {'students': students, 'sessions': sessions}

# Test cases
test_cases = [
    ('low_risk', 25, 'Excellent student - low risk'),
    ('moderate_risk', 25, 'Borderline student - moderate risk'),
    ('high_risk', 25, 'Failing student - high risk'),
    ('recovering', 25, 'Recovering student - improving'),
    ('low_risk', 5, 'Early stage - low risk (5 sessions)'),
    ('high_risk', 10, 'Early stage - high risk (10 sessions)'),
]

print("\nRunning test cases...\n")

for scenario, sessions, description in test_cases:
    print("-" * 80)
    print(f"TEST: {description}")
    print("-" * 80)
    
    data = generate_test_data(scenario, sessions)
    
    # Run prerequisite models
    model1_result = calculate_trend_analysis(data)
    model3_result = calculate_consistency_analysis(data)
    consistency = model3_result.get('consistency', 'regular')
    model4_result = analyze_attentiveness(data, consistency)
    
    # Generate class data
    class_data = generate_class_data(avg_attendance=80, total_students=50, total_sessions=sessions)
    
    # Run risk analysis
    result = analyze_risk(data, model1_result, model3_result, model4_result, class_data, total_sessions_planned=50)
    
    print(f"Scenario: {scenario}")
    print(f"Sessions: {sessions}")
    print(f"\nPREREQUISITE MODEL OUTPUTS:")
    print(f"  Model 1 (Trend): {model1_result.get('trend', 'N/A')}")
    print(f"  Model 3 (Consistency): {model3_result.get('consistency', 'N/A')}")
    print(f"  Model 4 (Attentiveness): {model4_result.get('attentiveness', 'N/A')}")
    
    print(f"\nRISK PREDICTION RESULTS:")
    print(f"  Status: {result.get('status', 'N/A')}")
    print(f"  Risk Level: {result.get('risk', 'N/A')}")
    print(f"  Confidence: {result.get('confidence', 'N/A')}")
    
    if 'probability' in result and result['probability']:
        prob = result['probability']
        print(f"\nRisk Probabilities:")
        print(f"  Low: {prob.get('low', 0)*100:.1f}%")
        print(f"  Moderate: {prob.get('moderate', 0)*100:.1f}%")
        print(f"  High: {prob.get('high', 0)*100:.1f}%")
    
    print(f"\nMessage: {result.get('message', 'N/A')}")
    
    if 'recommendations' in result and result['recommendations']:
        print(f"\nRecommendations:")
        for rec in result['recommendations'][:3]:
            print(f"  {rec}")
    
    if 'action_plan' in result:
        print(f"\nAction Plan: {result['action_plan']}")
    
    print()

print("="*80)
print("✅ MODEL 2 TEST COMPLETE")
print("="*80)

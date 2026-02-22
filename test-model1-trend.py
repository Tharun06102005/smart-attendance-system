"""
Test Script for Model 1: Trend Analysis
Tests the trend analysis model with various attendance patterns
"""

import sys
import json
from datetime import datetime, timedelta

sys.path.append('server/ml')
from model1_trend_analysis import calculate_trend_analysis

print("="*80)
print("MODEL 1: TREND ANALYSIS TEST")
print("="*80)

def generate_test_data(pattern_type, num_sessions=20):
    """Generate test attendance data with specific patterns"""
    records = []
    current_date = datetime(2024, 1, 1)
    
    for i in range(num_sessions):
        if pattern_type == 'improving':
            # Start low, end high
            is_present = i > (num_sessions * 0.3) or (i % 3 != 0)
        elif pattern_type == 'declining':
            # Start high, end low
            is_present = i < (num_sessions * 0.7) or (i % 3 == 0)
        elif pattern_type == 'stable_high':
            # Consistently high
            is_present = i % 5 != 0
        elif pattern_type == 'stable_low':
            # Consistently low
            is_present = i % 3 == 0
        else:  # random
            is_present = i % 2 == 0
        
        records.append({
            'status': 'present' if is_present else 'absent',
            'session_date': current_date.strftime('%Y-%m-%d')
        })
        current_date += timedelta(days=3)
    
    return records

# Test cases
test_cases = [
    ('improving', 20, 'Student with improving attendance'),
    ('declining', 20, 'Student with declining attendance'),
    ('stable_high', 20, 'Student with stable high attendance'),
    ('stable_low', 20, 'Student with stable low attendance'),
    ('improving', 5, 'Early stage - improving (5 sessions)'),
    ('declining', 3, 'Very early stage (3 sessions)'),
]

print("\nRunning test cases...\n")

for pattern, sessions, description in test_cases:
    print("-" * 80)
    print(f"TEST: {description}")
    print("-" * 80)
    
    data = generate_test_data(pattern, sessions)
    result = calculate_trend_analysis(data)
    
    print(f"Pattern Type: {pattern}")
    print(f"Sessions: {sessions}")
    print(f"\nRESULTS:")
    print(f"  Trend: {result['trend']}")
    print(f"  Confidence: {result['confidence']}")
    print(f"  Overall Attendance: {result['metrics'].get('overall_percentage', 0):.1f}%")
    
    if 'first_half_percentage' in result['metrics']:
        print(f"  First Half: {result['metrics']['first_half_percentage']:.1f}%")
        print(f"  Second Half: {result['metrics']['second_half_percentage']:.1f}%")
        print(f"  Change: {result['metrics']['percentage_change']:.1f}%")
    
    print(f"\nMessage: {result['message']}")
    
    if result['notes']:
        print(f"\nNotes:")
        for note in result['notes']:
            print(f"  {note}")
    
    print()

print("="*80)
print("✅ MODEL 1 TEST COMPLETE")
print("="*80)

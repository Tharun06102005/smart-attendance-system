"""
Test Script for Model 3: Consistency Analysis
Tests the consistency analysis model with various attendance patterns
"""

import sys
import json
from datetime import datetime, timedelta

sys.path.append('server/ml')
from model3_consistency_analysis import calculate_consistency_analysis

print("="*80)
print("MODEL 3: CONSISTENCY ANALYSIS TEST")
print("="*80)

def generate_test_data(pattern_type, num_sessions=20):
    """Generate test attendance data with specific consistency patterns"""
    records = []
    current_date = datetime(2024, 1, 1)
    
    for i in range(num_sessions):
        if pattern_type == 'regular':
            # Clustered absences with reasons
            is_present = not (5 <= i <= 7)  # 3 consecutive absences
            reason = 'Medical' if not is_present else None
        elif pattern_type == 'highly_irregular':
            # Scattered absences without reasons
            is_present = i % 3 != 0
            reason = None
        elif pattern_type == 'moderately_irregular':
            # Mix of clustered and scattered
            is_present = not (i in [3, 4, 10, 15])
            reason = 'Medical' if i in [3, 4] else None
        elif pattern_type == 'perfect':
            # Perfect attendance
            is_present = True
            reason = None
        else:  # single_absences
            # Many single absences
            is_present = i % 4 != 0
            reason = None
        
        records.append({
            'status': 'present' if is_present else 'absent',
            'session_date': current_date.strftime('%Y-%m-%d'),
            'reason_type': reason
        })
        current_date += timedelta(days=3)
    
    return records

# Test cases
test_cases = [
    ('regular', 20, 'Regular student with clustered absences'),
    ('highly_irregular', 20, 'Highly irregular with scattered absences'),
    ('moderately_irregular', 20, 'Moderately irregular mixed pattern'),
    ('perfect', 20, 'Perfect attendance'),
    ('single_absences', 20, 'Many single absences (bunking)'),
    ('regular', 5, 'Early stage - regular (5 sessions)'),
    ('highly_irregular', 3, 'Very early stage (3 sessions)'),
]

print("\nRunning test cases...\n")

for pattern, sessions, description in test_cases:
    print("-" * 80)
    print(f"TEST: {description}")
    print("-" * 80)
    
    data = generate_test_data(pattern, sessions)
    result = calculate_consistency_analysis(data)
    
    print(f"Pattern Type: {pattern}")
    print(f"Sessions: {sessions}")
    print(f"\nRESULTS:")
    print(f"  Consistency: {result['consistency']}")
    print(f"  Confidence: {result['confidence']}")
    print(f"  Overall Attendance: {result['metrics'].get('overall_percentage', 0):.1f}%")
    
    if 'clustering_score' in result['metrics']:
        print(f"  Clustering Score: {result['metrics']['clustering_score']:.1f}%")
        print(f"  Excused Percentage: {result['metrics']['excused_percentage']:.1f}%")
        print(f"  Single Absences: {result['metrics']['single_absences']}")
        print(f"  Max Absence Streak: {result['metrics']['max_absence_streak']}")
        print(f"  Discipline Score: {result['metrics']['discipline_score']}/100")
    
    print(f"\nMessage: {result['message']}")
    
    if result['notes']:
        print(f"\nNotes:")
        for note in result['notes'][:3]:  # Show first 3 notes
            print(f"  {note}")
    
    if result['recommendations']:
        print(f"\nRecommendations:")
        for rec in result['recommendations']:
            print(f"  {rec}")
    
    print()

print("="*80)
print("✅ MODEL 3 TEST COMPLETE")
print("="*80)

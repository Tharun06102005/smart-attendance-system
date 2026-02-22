"""
ML Model 1: Trend Analysis
Analyzes student attendance patterns to predict trends (improving/stable/declining)

Specification:
- Uses sliding window of last 20 sessions (or all if < 20)
- Minimum 10 sessions for reliable trend calculation
- 11 calculated features including volatility, consecutive absences, recent momentum
- Decision threshold: ±10% change between first and second half
- Confidence levels: none (<5), low (5-9), medium (10-14), high (15+)
"""

import json
import sys
from datetime import datetime
from typing import List, Dict, Any


def calculate_trend_analysis(attendance_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate trend analysis for a student's attendance records.
    
    Args:
        attendance_records: List of attendance records with 'status' and 'session_date' fields
        
    Returns:
        Dictionary containing trend classification, confidence, metrics, and messages
    """
    
    # Sort by date (most recent first)
    sorted_records = sorted(
        attendance_records,
        key=lambda x: x.get('session_date', ''),
        reverse=True
    )
    
    # Use sliding window of last 20 sessions (or all if < 20)
    window_size = min(20, len(sorted_records))
    window_records = sorted_records[:window_size]
    
    total_sessions = len(window_records)
    
    # Initialize result structure
    result = {
        'trend': 'stable',
        'confidence': 'none',
        'metrics': {},
        'message': '',
        'notes': [],
        'warnings': []
    }
    
    # Handle 0 sessions (no attendance taken yet)
    if total_sessions == 0:
        result['trend'] = 'no_data'
        result['confidence'] = 'none'
        result['metrics'] = {
            'total_sessions': 0,
            'overall_percentage': 0,
            'minimum_required': 5
        }
        result['message'] = 'No attendance records found. Attendance has not been taken yet for this subject.'
        result['notes'].append('⚠️ No attendance data available')
        result['notes'].append('Trend analysis will begin after first attendance session')
        result['warnings'].append('No attendance records found')
        return result
    
    # Handle very early sessions (1-4 sessions)
    if total_sessions < 5:
        present_count = sum(1 for r in window_records if r.get('status') in ['present', 'excused'])
        overall_percentage = (present_count / total_sessions * 100) if total_sessions > 0 else 0
        
        result['trend'] = 'stable'  # Default to stable for early sessions
        result['confidence'] = 'none'
        result['metrics'] = {
            'total_sessions': total_sessions,
            'overall_percentage': round(overall_percentage, 2),
            'minimum_required': 5
        }
        result['message'] = f'Early stage: Only {total_sessions} session(s) recorded. Trend analysis will be available after 5 sessions. Current attendance: {round(overall_percentage, 1)}%.'
        result['notes'].append(f'✓ Attendance tracking started')
        result['notes'].append(f'Current attendance: {round(overall_percentage, 1)}%')
        result['warnings'].append('Need at least 5 sessions for reliable trend analysis')
        return result
    
    # Feature 1: Total sessions count
    result['metrics']['total_sessions'] = total_sessions
    
    # Calculate present/absent counts
    present_count = sum(1 for r in window_records if r.get('status') in ['present', 'excused'])
    absent_count = total_sessions - present_count
    
    # Feature 2: Overall attendance percentage
    overall_percentage = (present_count / total_sessions * 100) if total_sessions > 0 else 0
    result['metrics']['overall_percentage'] = round(overall_percentage, 2)
    
    # Feature 3: Window percentage (same as overall for this window)
    result['metrics']['window_percentage'] = round(overall_percentage, 2)
    
    # Split into first half and second half (chronologically)
    # Reverse to get chronological order (oldest first)
    chronological_records = list(reversed(window_records))
    mid_point = total_sessions // 2
    
    first_half = chronological_records[:mid_point]
    second_half = chronological_records[mid_point:]
    
    # Feature 4: First half percentage
    first_half_present = sum(1 for r in first_half if r.get('status') in ['present', 'excused'])
    first_half_percentage = (first_half_present / len(first_half) * 100) if len(first_half) > 0 else 0
    result['metrics']['first_half_percentage'] = round(first_half_percentage, 2)
    result['metrics']['first_half_sessions'] = len(first_half)
    
    # Feature 5: Second half percentage
    second_half_present = sum(1 for r in second_half if r.get('status') in ['present', 'excused'])
    second_half_percentage = (second_half_present / len(second_half) * 100) if len(second_half) > 0 else 0
    result['metrics']['second_half_percentage'] = round(second_half_percentage, 2)
    result['metrics']['second_half_sessions'] = len(second_half)
    
    # Feature 6: Percentage change (second half - first half)
    percentage_change = second_half_percentage - first_half_percentage
    result['metrics']['percentage_change'] = round(percentage_change, 2)
    
    # Feature 7: Recent momentum (last 3 sessions)
    recent_sessions = sorted_records[:min(3, total_sessions)]
    recent_present = sum(1 for r in recent_sessions if r.get('status') in ['present', 'excused'])
    recent_momentum = (recent_present / len(recent_sessions) * 100) if len(recent_sessions) > 0 else 0
    result['metrics']['recent_momentum'] = round(recent_momentum, 2)
    result['metrics']['recent_sessions_count'] = len(recent_sessions)
    
    # Feature 8: Consecutive absence streak (from most recent)
    consecutive_absences = 0
    for record in sorted_records:
        if record.get('status') == 'absent':
            consecutive_absences += 1
        else:
            break
    result['metrics']['consecutive_absence_streak'] = consecutive_absences
    
    # Feature 9: Volatility score (standard deviation of attendance)
    # Calculate attendance as binary (1 for present, 0 for absent)
    attendance_binary = [1 if r.get('status') in ['present', 'excused'] else 0 for r in window_records]
    if len(attendance_binary) > 1:
        mean = sum(attendance_binary) / len(attendance_binary)
        variance = sum((x - mean) ** 2 for x in attendance_binary) / len(attendance_binary)
        volatility = variance ** 0.5
    else:
        volatility = 0
    result['metrics']['volatility_score'] = round(volatility, 4)
    
    # Feature 10: Time span analysis
    if len(window_records) >= 2:
        try:
            oldest_date = datetime.fromisoformat(chronological_records[0].get('session_date', ''))
            newest_date = datetime.fromisoformat(chronological_records[-1].get('session_date', ''))
            time_span_days = (newest_date - oldest_date).days
            result['metrics']['time_span_days'] = time_span_days
        except (ValueError, TypeError):
            result['metrics']['time_span_days'] = 0
            result['warnings'].append('Could not calculate time span due to invalid dates')
    else:
        result['metrics']['time_span_days'] = 0
    
    # Feature 11: Confidence level
    if total_sessions < 5:
        confidence = 'none'
    elif total_sessions < 10:
        confidence = 'low'
    elif total_sessions < 15:
        confidence = 'medium'
    else:
        confidence = 'high'
    result['confidence'] = confidence
    result['metrics']['confidence_level'] = confidence
    
    # Decision Logic: Determine trend based on percentage change
    if total_sessions < 10:
        result['warnings'].append(f'Only {total_sessions} sessions available. Trend calculation is less reliable with fewer than 10 sessions.')
    
    # Apply decision threshold: ±10%
    if percentage_change > 10:
        result['trend'] = 'improving'
        result['message'] = f'Attendance is improving! Second half ({second_half_percentage:.1f}%) is {percentage_change:.1f}% higher than first half ({first_half_percentage:.1f}%).'
    elif percentage_change < -10:
        result['trend'] = 'declining'
        result['message'] = f'Attendance is declining. Second half ({second_half_percentage:.1f}%) is {abs(percentage_change):.1f}% lower than first half ({first_half_percentage:.1f}%).'
    else:
        result['trend'] = 'stable'
        result['message'] = f'Attendance is stable. Change between halves is {percentage_change:.1f}%, within ±10% threshold.'
    
    # Add contextual notes
    if consecutive_absences >= 3:
        result['notes'].append(f'⚠️ Currently on a {consecutive_absences}-session absence streak')
    
    if recent_momentum >= 80:
        result['notes'].append(f'✓ Strong recent momentum: {recent_momentum:.0f}% attendance in last {len(recent_sessions)} sessions')
    elif recent_momentum <= 33:
        result['notes'].append(f'⚠️ Weak recent momentum: {recent_momentum:.0f}% attendance in last {len(recent_sessions)} sessions')
    
    if volatility > 0.4:
        result['notes'].append('⚠️ High volatility detected: Attendance pattern is irregular')
    elif volatility < 0.2:
        result['notes'].append('✓ Low volatility: Attendance pattern is consistent')
    
    if overall_percentage < 75:
        result['notes'].append(f'⚠️ Overall attendance ({overall_percentage:.1f}%) is below 75% threshold')
    elif overall_percentage >= 90:
        result['notes'].append(f'✓ Excellent overall attendance: {overall_percentage:.1f}%')
    
    return result


def main():
    """
    Main function to read attendance data from stdin and output trend analysis.
    Expected input format: JSON array of attendance records
    """
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        attendance_records = json.loads(input_data)
        
        # Calculate trend analysis
        result = calculate_trend_analysis(attendance_records)
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except json.JSONDecodeError as e:
        error_result = {
            'error': 'Invalid JSON input',
            'message': str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
    except Exception as e:
        error_result = {
            'error': 'Calculation failed',
            'message': str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()

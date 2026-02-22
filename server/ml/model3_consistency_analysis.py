"""
ML Model 3: Consistency Analysis
Analyzes student attendance patterns to determine consistency/discipline level

Specification:
- Uses FULL history (enrollment to present) - not sliding window
- Minimum 10 sessions recommended for reliable consistency analysis
- Minimum 5 sessions for basic analysis
- Analyzes how disciplined and reliable a student's attendance pattern is
- Key insight: Clustered absences (consecutive) = Valid reason = GOOD
                Scattered absences (random) = No valid reason = BAD

Status Options:
- 'present': Student attended
- 'absent' with reason_type = NULL: Absent without reason (bunking)
- 'absent' with reason_type != NULL: Absent with valid reason (excused)
"""

import json
import sys
from datetime import datetime
from typing import List, Dict, Any


def calculate_consistency_analysis(attendance_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate consistency analysis for a student's attendance records.
    
    Args:
        attendance_records: List of attendance records with 'status', 'session_date', and 'reason_type' fields
        
    Returns:
        Dictionary containing consistency classification, confidence, metrics, and messages
    """
    
    # Sort by date (oldest first for chronological analysis)
    sorted_records = sorted(
        attendance_records,
        key=lambda x: x.get('session_date', ''),
        reverse=False
    )
    
    total_sessions = len(sorted_records)
    
    # Initialize result structure
    result = {
        'consistency': 'regular',
        'confidence': 'none',
        'metrics': {},
        'message': '',
        'notes': [],
        'warnings': [],
        'recommendations': []
    }
    
    # Handle 0 sessions (no attendance taken yet)
    if total_sessions == 0:
        result['consistency'] = 'no_data'
        result['confidence'] = 'none'
        result['metrics'] = {
            'total_sessions': 0,
            'overall_percentage': 0,
            'minimum_required': 5
        }
        result['message'] = 'No attendance records found. Attendance has not been taken yet for this subject.'
        result['notes'].append('⚠️ No attendance data available')
        result['notes'].append('Consistency analysis will begin after first attendance session')
        result['warnings'].append('No attendance records found')
        return result
    
    # Handle very early sessions (1-4 sessions)
    if total_sessions < 5:
        present_count = sum(1 for r in sorted_records if r.get('status') == 'present')
        absent_count = total_sessions - present_count
        overall_percentage = (present_count / total_sessions * 100) if total_sessions > 0 else 0
        
        result['consistency'] = 'regular'  # Default to regular for early sessions
        result['confidence'] = 'none'
        result['metrics'] = {
            'total_sessions': total_sessions,
            'overall_percentage': round(overall_percentage, 2),
            'minimum_required': 5
        }
        result['message'] = f'Early stage: Only {total_sessions} session(s) recorded. Consistency analysis will be more reliable after 5 sessions. Current attendance: {round(overall_percentage, 1)}%.'
        result['notes'].append(f'✓ Attendance tracking started')
        result['notes'].append(f'Current attendance: {round(overall_percentage, 1)}%')
        
        if absent_count > 0:
            result['notes'].append(f'⚠️ {absent_count} absence(s) in early stage')
        
        result['warnings'].append('Need at least 5 sessions for reliable consistency analysis')
        return result
    
    # Feature 1: Total sessions count
    result['metrics']['total_sessions'] = total_sessions
    
    # Separate present and absent records
    present_count = sum(1 for r in sorted_records if r.get('status') == 'present')
    absent_records = [r for r in sorted_records if r.get('status') == 'absent']
    absent_count = len(absent_records)
    
    # Feature 2: Overall attendance percentage
    overall_percentage = (present_count / total_sessions * 100) if total_sessions > 0 else 0
    result['metrics']['overall_percentage'] = round(overall_percentage, 2)
    
    # If no absences, perfect attendance
    if absent_count == 0:
        result['consistency'] = 'regular'
        result['confidence'] = get_confidence_level(total_sessions)
        result['metrics']['clustering_score'] = 0
        result['metrics']['consecutive_absence_incidents'] = 0
        result['metrics']['max_absence_streak'] = 0
        result['metrics']['single_absences'] = 0
        result['metrics']['excused_percentage'] = 0
        result['metrics']['discipline_score'] = 100
        result['message'] = 'Perfect attendance! Student has not missed a single class.'
        result['notes'].append('✓ Perfect attendance record')
        result['notes'].append('✓ Excellent discipline and commitment')
        return result
    
    # Feature 3: Excused vs Unexcused absences
    excused_absences = [r for r in absent_records if r.get('reason_type') is not None and r.get('reason_type') != '']
    unexcused_absences = [r for r in absent_records if r.get('reason_type') is None or r.get('reason_type') == '']
    
    excused_count = len(excused_absences)
    unexcused_count = len(unexcused_absences)
    excused_percentage = (excused_count / absent_count * 100) if absent_count > 0 else 0
    
    result['metrics']['excused_percentage'] = round(excused_percentage, 2)
    result['metrics']['excused_count'] = excused_count
    result['metrics']['unexcused_count'] = unexcused_count
    
    # Feature 4: Consecutive Absence Streaks Analysis
    consecutive_streaks = []
    current_streak = []
    
    for i, record in enumerate(sorted_records):
        if record.get('status') == 'absent':
            current_streak.append(i)
        else:
            if len(current_streak) > 1:  # Only count streaks of 2 or more
                consecutive_streaks.append(current_streak)
            current_streak = []
    
    # Don't forget the last streak if it exists
    if len(current_streak) > 1:
        consecutive_streaks.append(current_streak)
    
    num_consecutive_incidents = len(consecutive_streaks)
    max_absence_streak = max([len(streak) for streak in consecutive_streaks]) if consecutive_streaks else 1
    
    result['metrics']['consecutive_absence_incidents'] = num_consecutive_incidents
    result['metrics']['max_absence_streak'] = max_absence_streak
    
    # Feature 5: Single Absences (isolated, not in streaks)
    absences_in_streaks = sum(len(streak) for streak in consecutive_streaks)
    single_absences = absent_count - absences_in_streaks
    
    result['metrics']['single_absences'] = single_absences
    
    # Feature 6: Clustering Score
    # High clustering = absences are grouped together = GOOD (valid reasons)
    # Low clustering = absences are scattered = BAD (random bunking)
    clustering_score = (absences_in_streaks / absent_count * 100) if absent_count > 0 else 0
    result['metrics']['clustering_score'] = round(clustering_score, 2)
    
    # Feature 7: Confidence Level
    confidence = get_confidence_level(total_sessions)
    result['confidence'] = confidence
    result['metrics']['confidence_level'] = confidence
    
    # Feature 8: Discipline Score (0-100)
    discipline_score = calculate_discipline_score(
        clustering_score,
        excused_percentage,
        num_consecutive_incidents,
        max_absence_streak,
        single_absences,
        overall_percentage
    )
    result['metrics']['discipline_score'] = discipline_score
    
    # Decision Logic: Determine consistency classification
    consistency = classify_consistency(
        clustering_score,
        excused_percentage,
        num_consecutive_incidents,
        max_absence_streak,
        single_absences,
        overall_percentage
    )
    result['consistency'] = consistency
    
    # Generate message based on classification
    result['message'] = generate_message(
        consistency,
        clustering_score,
        excused_percentage,
        num_consecutive_incidents,
        max_absence_streak,
        overall_percentage
    )
    
    # Generate contextual notes
    generate_notes(result, clustering_score, excused_percentage, num_consecutive_incidents, 
                   max_absence_streak, single_absences, overall_percentage, total_sessions)
    
    # Generate warnings if needed
    generate_warnings(result, overall_percentage, max_absence_streak, num_consecutive_incidents)
    
    # Generate recommendations
    generate_recommendations(result, consistency, overall_percentage, single_absences)
    
    return result


def get_confidence_level(total_sessions: int) -> str:
    """Determine confidence level based on number of sessions"""
    if total_sessions < 5:
        return 'none'
    elif total_sessions < 10:
        return 'low'
    elif total_sessions < 15:
        return 'medium'
    else:
        return 'high'


def calculate_discipline_score(clustering: float, excused_pct: float, incidents: int, 
                               max_streak: int, single_abs: int, attendance_pct: float) -> int:
    """Calculate overall discipline score (0-100)"""
    score = 0
    
    # Factor 1: High clustering is GOOD (30 points)
    if clustering >= 70:
        score += 30
    elif clustering >= 40:
        score += 15
    
    # Factor 2: High excused percentage is GOOD (25 points)
    if excused_pct >= 80:
        score += 25
    elif excused_pct >= 50:
        score += 15
    elif excused_pct >= 30:
        score += 5
    
    # Factor 3: Few incidents is GOOD (20 points)
    if incidents == 0:
        score += 20
    elif incidents <= 2:
        score += 15
    elif incidents <= 4:
        score += 5
    
    # Factor 4: Short max streak is GOOD (15 points)
    if max_streak <= 3:
        score += 15
    elif max_streak <= 5:
        score += 10
    elif max_streak <= 7:
        score += 5
    
    # Factor 5: Few single absences is GOOD (10 points)
    if single_abs == 0:
        score += 10
    elif single_abs <= 2:
        score += 5
    
    return min(100, score)


def classify_consistency(clustering: float, excused_pct: float, incidents: int,
                        max_streak: int, single_abs: int, attendance_pct: float) -> str:
    """Classify consistency level based on metrics"""
    
    # REGULAR (Consistent/Disciplined)
    if (clustering >= 70 and excused_pct >= 60 and incidents <= 2 and 
        max_streak <= 7 and single_abs <= 2):
        return 'regular'
    
    # HIGHLY IRREGULAR (Inconsistent/Undisciplined)
    if (clustering < 30 or excused_pct < 30 or single_abs > 5 or 
        (max_streak > 10 and excused_pct < 50)):
        return 'highly_irregular'
    
    # MODERATELY IRREGULAR (everything else)
    return 'moderately_irregular'


def generate_message(consistency: str, clustering: float, excused_pct: float,
                    incidents: int, max_streak: int, attendance_pct: float) -> str:
    """Generate human-readable message based on classification"""
    
    if consistency == 'regular':
        if incidents == 0:
            return "Student shows consistent attendance with well-distributed absences. Pattern indicates disciplined behavior."
        elif incidents == 1:
            return "Student shows consistent attendance with one valid absence period. Overall pattern is regular and reliable."
        else:
            return "Student shows consistent attendance. Multiple absence periods are all valid with proper reasons. Disciplined behavior."
    
    elif consistency == 'moderately_irregular':
        if max_streak > 7:
            return f"Student had one extended absence period ({max_streak} sessions). While excused, the length is concerning and affects consistency. Consider academic support upon return."
        elif excused_pct >= 50:
            return "Student shows moderately irregular attendance. Had valid absence periods but also has some random absences without valid reasons."
        else:
            return "Student shows moderately irregular attendance with mixed behavior. Some absences are valid but pattern shows inconsistency."
    
    else:  # highly_irregular
        if clustering < 30:
            return "Student shows highly irregular attendance with scattered absences. Pattern suggests lack of commitment or discipline. No clear reason for absences."
        elif excused_pct < 30:
            return "Student shows highly irregular attendance. Most absences lack valid reasons, indicating poor discipline and commitment."
        else:
            return "Student shows extremely irregular attendance pattern. Combination of frequent absences and inconsistent behavior indicates severe discipline issues. Immediate intervention required."


def generate_notes(result: dict, clustering: float, excused_pct: float, incidents: int,
                  max_streak: int, single_abs: int, attendance_pct: float, total_sessions: int):
    """Generate contextual notes"""
    
    # Positive notes
    if clustering >= 70:
        result['notes'].append('✓ Most absences are clustered (valid reasons)')
    
    if excused_pct >= 80:
        result['notes'].append(f'✓ {round(excused_pct)}% of absences are excused')
    elif excused_pct >= 50:
        result['notes'].append(f'✓ {round(excused_pct)}% of absences have valid reasons')
    
    if incidents == 0:
        result['notes'].append('✓ No consecutive absence streaks (well distributed)')
    elif incidents == 1:
        result['notes'].append('✓ Only one absence period (likely valid reason)')
    
    if attendance_pct >= 90:
        result['notes'].append(f'✓ Excellent overall attendance: {round(attendance_pct, 1)}%')
    elif attendance_pct >= 75:
        result['notes'].append(f'✓ Good overall attendance: {round(attendance_pct, 1)}%')
    
    # Warning notes
    if clustering < 30:
        result['notes'].append('⚠️ All absences are scattered (no clustering)')
    
    if excused_pct < 30:
        result['notes'].append(f'⚠️ Only {round(excused_pct)}% of absences are excused (no valid reasons)')
    
    if single_abs > 5:
        result['notes'].append(f'⚠️ {single_abs} single absences indicate random bunking')
    elif single_abs > 2:
        result['notes'].append(f'⚠️ {single_abs} single absences without valid reasons')
    
    if max_streak > 7:
        result['notes'].append(f'⚠️ Very long absence streak ({max_streak} sessions)')
    elif max_streak > 4:
        result['notes'].append(f'⚠️ Long absence streak ({max_streak} sessions)')
    
    if incidents > 3:
        result['notes'].append(f'⚠️ {incidents} separate absence incidents (health concerns?)')
    
    if attendance_pct < 75:
        result['notes'].append(f'⚠️ Attendance below 75% threshold ({round(attendance_pct, 1)}%)')
    
    if total_sessions < 10:
        result['notes'].append(f'⚠️ Only {total_sessions} sessions available. Analysis is less reliable with fewer than 10 sessions.')


def generate_warnings(result: dict, attendance_pct: float, max_streak: int, incidents: int):
    """Generate warnings for concerning patterns"""
    
    if attendance_pct < 50:
        result['warnings'].append('CRITICAL: Attendance below 50%')
        result['warnings'].append('Risk of academic failure')
    elif attendance_pct < 75:
        result['warnings'].append('Below 75% threshold - at risk')
    
    if max_streak >= 8:
        result['warnings'].append('Extended absence - academic intervention needed')
    
    if incidents > 3:
        result['warnings'].append('Multiple medical leaves - consider health support')


def generate_recommendations(result: dict, consistency: str, attendance_pct: float, single_abs: int):
    """Generate actionable recommendations"""
    
    if consistency == 'regular':
        result['recommendations'].append('Continue current positive attendance pattern')
    
    elif consistency == 'moderately_irregular':
        result['recommendations'].append('Monitor for improvement')
        if single_abs > 0:
            result['recommendations'].append('Reduce random absences')
    
    else:  # highly_irregular
        result['recommendations'].append('Immediate counseling session required')
        if attendance_pct < 50:
            result['recommendations'].append('Parent/guardian notification')
            result['recommendations'].append('Academic probation consideration')
        result['recommendations'].append('Investigate underlying issues')


def main():
    """
    Main function to read attendance data from stdin and output consistency analysis.
    Expected input format: JSON array of attendance records
    """
    try:
        # Debug: Print to stderr to see if we get here
        print("Starting Model 3...", file=sys.stderr, flush=True)
        
        # Read input from stdin
        input_data = sys.stdin.read()
        print(f"Received {len(input_data)} bytes", file=sys.stderr, flush=True)
        
        attendance_records = json.loads(input_data)
        print(f"Parsed {len(attendance_records)} records", file=sys.stderr, flush=True)
        
        # Calculate consistency analysis
        result = calculate_consistency_analysis(attendance_records)
        print("Calculation complete", file=sys.stderr, flush=True)
        
        # Output result as JSON
        output = json.dumps(result, indent=2)
        print(output, flush=True)
        
    except json.JSONDecodeError as e:
        error_result = {
            'error': 'Invalid JSON input',
            'message': str(e)
        }
        print(json.dumps(error_result, indent=2), flush=True)
        sys.exit(1)
    except Exception as e:
        error_result = {
            'error': 'Calculation failed',
            'message': str(e)
        }
        print(json.dumps(error_result, indent=2), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    # Quick test to see if script runs
    print("Script loaded successfully", file=sys.stderr, flush=True)
    main()

"""
Model 2: Risk Prediction Analysis
Predicts student attendance risk level using trained Random Forest model

This model uses 45 features across 7 categories to predict if a student
will fail the attendance requirement (< 75%)

ENHANCED VERSION (v2):
- 45 features (11 NEW features added)
- Trained on 5000 samples
- Target accuracy: 95%+
"""

import sys
import json
import numpy as np
import pickle
from datetime import datetime

# ============================================================================
# LOAD TRAINED MODEL
# ============================================================================

MODEL_PATH = 'server/ml/risk_prediction_model.pkl'

try:
    with open(MODEL_PATH, 'rb') as f:
        model_data = pickle.load(f)
        MODEL = model_data['model']
        FEATURE_NAMES = model_data['feature_names']
        MODEL_ACCURACY = model_data['test_accuracy']
except FileNotFoundError:
    print(json.dumps({
        'status': 'error',
        'message': 'Trained model not found. Please run train_risk_model.py first.'
    }))
    sys.exit(1)

# ============================================================================
# FEATURE EXTRACTION
# ============================================================================

def extract_features(student_data, model1_result, model3_result, model4_result, class_data, total_sessions_planned=80):
    """
    Extract all 45 features from student data and other model results
    
    ENHANCED VERSION (v2): 45 features (11 NEW features added)
    
    Args:
        student_data: List of attendance records for the student
            Each record: {
                status: 'present' or 'absent',
                reason_type: 'Medical' or null (for excused absences),
                session_date: '2024-01-01',
                attentiveness: 'High' or 'Medium' or 'Low' (optional),
                emotion: 'happy', 'sad', 'neutral', etc. (optional)
            }
        model1_result: Result from Model 1 (Trend Analysis)
        model3_result: Result from Model 3 (Consistency Analysis)
        model4_result: Result from Model 4 (Attentiveness Analysis)
        class_data: Class-level attendance data for peer comparison
            {
                sessions: {
                    'date': {total_students, present_count, absent_count}
                },
                students: [{id, records: [...]}]
            }
        total_sessions_planned: Total sessions expected in semester (default: 50)
    
    Returns:
        List of 45 feature values
    """
    features = []
    
    # ========================================================================
    # Category 1: Current State Features (7 features)
    # ========================================================================
    
    total_sessions = len(student_data)
    present_count = sum(1 for r in student_data if r.get('status') == 'present')
    absent_count = total_sessions - present_count
    
    # Calculate current attendance percentage
    current_attendance = (present_count / total_sessions * 100) if total_sessions > 0 else 0
    
    # Count excused vs unexcused absences
    excused_absence_count = sum(
        1 for r in student_data 
        if r.get('status') == 'absent' and r.get('reason_type') is not None
    )
    unexcused_absence_count = absent_count - excused_absence_count
    
    # Calculate attendance variance (consistency of attendance)
    if total_sessions >= 5:
        # Calculate rolling attendance (1=present, 0=absent)
        attendance_values = [1 if r.get('status') == 'present' else 0 for r in student_data]
        attendance_variance = np.std(attendance_values) * 100
    else:
        attendance_variance = 0
    
    features.extend([
        current_attendance,           # 1
        total_sessions,               # 2
        present_count,                # 3
        absent_count,                 # 4
        excused_absence_count,        # 5
        unexcused_absence_count,      # 6
        attendance_variance           # 7
    ])
    
    # ========================================================================
    # Category 2: Trend Features (7 features) - From Model 1 + 2 NEW!
    # ========================================================================
    
    # Map trend to numeric
    trend_map = {'improving': 1, 'stable': 0, 'declining': -1}
    trend_direction = trend_map.get(model1_result.get('trend', 'stable'), 0)
    
    # Trend strength (0-1 scale)
    trend_strength = model1_result.get('features', {}).get('trend_strength', 0.5)
    
    # Recent attendance rates
    recent_5 = student_data[-5:] if len(student_data) >= 5 else student_data
    recent_10 = student_data[-10:] if len(student_data) >= 10 else student_data
    
    recent_5_present = sum(1 for r in recent_5 if r.get('status') == 'present')
    recent_10_present = sum(1 for r in recent_10 if r.get('status') == 'present')
    
    recent_5_rate = (recent_5_present / len(recent_5) * 100) if recent_5 else 0
    recent_10_rate = (recent_10_present / len(recent_10) * 100) if recent_10 else 0
    
    # Trend slope (rate of change per session)
    if total_sessions >= 10:
        first_half = student_data[:total_sessions//2]
        second_half = student_data[total_sessions//2:]
        
        first_half_rate = sum(1 for r in first_half if r.get('status') == 'present') / len(first_half) * 100
        second_half_rate = sum(1 for r in second_half if r.get('status') == 'present') / len(second_half) * 100
        
        trend_slope = (second_half_rate - first_half_rate) / (total_sessions / 2)
    else:
        trend_slope = 0
    
    # NEW FEATURE 1: Trend Acceleration (rate of change of trend)
    if total_sessions >= 15:
        # Split into thirds to calculate acceleration
        third = total_sessions // 3
        first_third = student_data[:third]
        second_third = student_data[third:2*third]
        third_third = student_data[2*third:]
        
        first_rate = sum(1 for r in first_third if r.get('status') == 'present') / len(first_third) * 100
        second_rate = sum(1 for r in second_third if r.get('status') == 'present') / len(second_third) * 100
        third_rate = sum(1 for r in third_third if r.get('status') == 'present') / len(third_third) * 100
        
        # Acceleration = change in slope
        slope1 = (second_rate - first_rate) / third
        slope2 = (third_rate - second_rate) / third
        trend_acceleration = slope2 - slope1
    else:
        trend_acceleration = 0
    
    # NEW FEATURE 2: Recent vs Overall Difference
    recent_vs_overall_diff = recent_5_rate - current_attendance
    
    features.extend([
        trend_direction,              # 8
        trend_strength,               # 9
        recent_5_rate,                # 10
        recent_10_rate,               # 11
        trend_slope,                  # 12
        trend_acceleration,           # 13 - NEW!
        recent_vs_overall_diff        # 14 - NEW!
    ])
    
    # ========================================================================
    # Category 3: Pattern Features (7 features) - From Model 3 + 2 NEW!
    # ========================================================================
    
    # Map consistency to numeric
    consistency_map = {'regular': 1, 'moderately_irregular': 0.5, 'highly_irregular': 0}
    consistency_score = consistency_map.get(model3_result.get('consistency', 'moderately_irregular'), 0.5)
    
    # Get pattern features from Model 3
    model3_features = model3_result.get('features', {})
    consecutive_absences_max = model3_features.get('max_consecutive_absences', 0)
    consecutive_absences_avg = model3_features.get('avg_consecutive_absences', 0)
    absence_clustering_score = model3_features.get('clustering_score', 0.5)
    
    # Calculate attendance regularity (inverse of variance)
    attendance_regularity = 1 - (attendance_variance / 100) if attendance_variance < 100 else 0
    
    # NEW FEATURE 3: Absence Frequency (how often absences occur)
    if total_sessions > 0:
        absence_frequency = absent_count / total_sessions
    else:
        absence_frequency = 0
    
    # NEW FEATURE 4: Attendance Stability (consistency over time)
    if total_sessions >= 10:
        # Calculate rolling 5-session attendance rates
        rolling_rates = []
        for i in range(total_sessions - 4):
            window = student_data[i:i+5]
            window_present = sum(1 for r in window if r.get('status') == 'present')
            rolling_rates.append(window_present / 5)
        
        # Stability = inverse of standard deviation of rolling rates
        if rolling_rates:
            attendance_stability = 1 - min(1.0, np.std(rolling_rates) * 2)
        else:
            attendance_stability = 0.5
    else:
        attendance_stability = 0.5
    
    features.extend([
        consistency_score,            # 15
        consecutive_absences_max,     # 16
        consecutive_absences_avg,     # 17
        absence_clustering_score,     # 18
        attendance_regularity,        # 19
        absence_frequency,            # 20 - NEW!
        attendance_stability          # 21 - NEW!
    ])
    
    # ========================================================================
    # Category 4: Engagement Features (5 features) - From Model 4 + 2 NEW!
    # ========================================================================
    
    # Map attentiveness to numeric
    attentiveness_map = {'actively_attentive': 1, 'moderately_attentive': 0.5, 'passively_attentive': 0}
    attentiveness_level = attentiveness_map.get(model4_result.get('attentiveness', 'moderately_attentive'), 0.5)
    
    # Get engagement features from Model 4
    model4_features = model4_result.get('features', {})
    average_attentiveness_score = model4_features.get('average_attentiveness_score', 2.0)
    positive_emotion_ratio = model4_features.get('positive_emotion_ratio', 0.3)
    
    # NEW FEATURE 5: Engagement Trend (is engagement improving?)
    if total_sessions >= 10:
        # Compare first half vs second half attentiveness
        first_half_att = []
        second_half_att = []
        
        for i, record in enumerate(student_data):
            att = record.get('attentiveness', 'Medium')
            att_score = {'High': 3, 'Medium': 2, 'Low': 1}.get(att, 2)
            
            if i < total_sessions // 2:
                first_half_att.append(att_score)
            else:
                second_half_att.append(att_score)
        
        if first_half_att and second_half_att:
            first_avg = np.mean(first_half_att)
            second_avg = np.mean(second_half_att)
            engagement_trend = (second_avg - first_avg) / 3  # Normalize to -1 to 1
        else:
            engagement_trend = 0
    else:
        engagement_trend = 0
    
    # NEW FEATURE 6: Attentiveness Consistency
    if total_sessions >= 5:
        att_scores = []
        for record in student_data:
            att = record.get('attentiveness', 'Medium')
            att_score = {'High': 3, 'Medium': 2, 'Low': 1}.get(att, 2)
            att_scores.append(att_score)
        
        if att_scores:
            # Consistency = inverse of coefficient of variation
            att_std = np.std(att_scores)
            att_mean = np.mean(att_scores)
            if att_mean > 0:
                attentiveness_consistency = 1 - min(1.0, att_std / att_mean)
            else:
                attentiveness_consistency = 0.5
        else:
            attentiveness_consistency = 0.5
    else:
        attentiveness_consistency = 0.5
    
    features.extend([
        attentiveness_level,          # 22
        average_attentiveness_score,  # 23
        positive_emotion_ratio,       # 24
        engagement_trend,             # 25 - NEW!
        attentiveness_consistency     # 26 - NEW!
    ])
    
    # ========================================================================
    # Category 5: Temporal Features (5 features) + 2 NEW!
    # ========================================================================
    
    # Use provided total_sessions_planned or default to 50
    sessions_remaining = max(0, total_sessions_planned - total_sessions)
    semester_progress = min(1.0, total_sessions / total_sessions_planned) if total_sessions_planned > 0 else 0
    
    # Calculate weeks since enrollment (approximate)
    if student_data:
        first_date = student_data[0].get('session_date', '')
        if first_date:
            try:
                first_datetime = datetime.fromisoformat(first_date.replace('Z', '+00:00'))
                weeks_since_enrollment = (datetime.now() - first_datetime).days / 7
            except:
                weeks_since_enrollment = total_sessions / 2  # Approximate: 2 sessions per week
        else:
            weeks_since_enrollment = total_sessions / 2
    else:
        weeks_since_enrollment = 0
    
    # NEW FEATURE 7: Time Pressure (how urgent is recovery?)
    if current_attendance < 75:
        # Higher pressure with less time remaining
        time_pressure = 1.0 - (sessions_remaining / total_sessions_planned) if total_sessions_planned > 0 else 1.0
    else:
        time_pressure = 0.0
    
    # NEW FEATURE 8: Semester Phase (early/mid/late)
    if semester_progress < 0.33:
        semester_phase = 0  # Early semester
    elif semester_progress < 0.67:
        semester_phase = 0.5  # Mid semester
    else:
        semester_phase = 1.0  # Late semester
    
    features.extend([
        semester_progress,            # 27
        sessions_remaining,           # 28
        weeks_since_enrollment,       # 29
        time_pressure,                # 30 - NEW!
        semester_phase                # 31 - NEW!
    ])
    
    # ========================================================================
    # Category 6: Recovery & Prediction Features (8 features) + 2 NEW!
    # ========================================================================
    
    # Calculate best possible attendance if student attends ALL remaining sessions
    best_possible_present = present_count + sessions_remaining
    best_possible_attendance = (best_possible_present / total_sessions_planned * 100) if total_sessions_planned > 0 else 0
    
    # Check if recovery to 75% is possible
    recovery_possible = 1 if best_possible_attendance >= 75 else 0
    
    # Calculate sessions needed to reach 75%
    sessions_needed_for_75 = max(0, int(np.ceil((0.75 * total_sessions_planned) - present_count)))
    
    # Calculate recovery difficulty
    if not recovery_possible:
        recovery_difficulty = -1  # Impossible
    elif sessions_needed_for_75 == 0:
        recovery_difficulty = 1   # Already above 75%
    elif sessions_needed_for_75 <= sessions_remaining * 0.3:
        recovery_difficulty = 1   # Easy (need < 30% of remaining)
    elif sessions_needed_for_75 <= sessions_remaining * 0.7:
        recovery_difficulty = 0.5 # Medium (need 30-70% of remaining)
    elif sessions_needed_for_75 <= sessions_remaining:
        recovery_difficulty = 0.2 # Hard (need > 70% of remaining)
    else:
        recovery_difficulty = -1  # Impossible
    
    # NEW FEATURE 9: Recovery Margin (buffer after recovery)
    if recovery_possible and sessions_needed_for_75 == 0:
        # Already above 75%, calculate buffer
        recovery_margin = (current_attendance - 75) / 100
    elif recovery_possible and sessions_needed_for_75 <= sessions_remaining * 0.3:
        # Easy recovery, good margin
        recovery_margin = 0.3
    elif recovery_possible and sessions_needed_for_75 <= sessions_remaining * 0.7:
        # Medium recovery, small margin
        recovery_margin = 0.1
    elif recovery_possible:
        # Hard recovery, no margin
        recovery_margin = 0.0
    else:
        # Impossible recovery
        recovery_margin = 0.0
    
    # NEW FEATURE 10: Failure Certainty (probability of failure)
    if not recovery_possible:
        failure_certainty = 1.0  # Certain failure
    elif current_attendance >= 75:
        # Calculate how many absences can be afforded
        buffer = current_attendance - 75
        max_absences_allowed = int((buffer / 100) * sessions_remaining)
        if max_absences_allowed >= sessions_remaining * 0.5:
            failure_certainty = 0.0  # Very safe
        elif max_absences_allowed >= sessions_remaining * 0.3:
            failure_certainty = 0.1  # Safe
        else:
            failure_certainty = 0.3  # Some risk
    else:
        # Below 75%, calculate risk based on recovery difficulty
        if sessions_needed_for_75 > sessions_remaining:
            failure_certainty = 1.0  # Impossible
        elif sessions_needed_for_75 > sessions_remaining * 0.9:
            failure_certainty = 0.8  # Very high risk
        elif sessions_needed_for_75 > sessions_remaining * 0.7:
            failure_certainty = 0.6  # High risk
        elif sessions_needed_for_75 > sessions_remaining * 0.5:
            failure_certainty = 0.4  # Moderate risk
        else:
            failure_certainty = 0.2  # Low risk
    
    features.extend([
        total_sessions_planned,       # 32
        sessions_remaining,           # 33 (duplicate for model compatibility)
        best_possible_attendance,     # 34
        recovery_possible,            # 35
        sessions_needed_for_75,       # 36
        recovery_difficulty,          # 37
        recovery_margin,              # 38 - NEW!
        failure_certainty             # 39 - NEW!
    ])
    
    # ========================================================================
    # Category 7: Class Context Features (6 features) + 1 NEW!
    # ========================================================================
    
    # Calculate class average attendance
    if class_data and 'students' in class_data:
        class_attendances = []
        for student in class_data['students']:
            s_total = len(student.get('records', []))
            s_present = sum(1 for r in student.get('records', []) if r.get('status') == 'present')
            s_attendance = (s_present / s_total * 100) if s_total > 0 else 0
            class_attendances.append(s_attendance)
        
        class_average_attendance = np.mean(class_attendances) if class_attendances else 75
    else:
        class_average_attendance = 75  # Default assumption
    
    # Student vs class difference
    student_vs_class_difference = current_attendance - class_average_attendance
    
    # Calculate class attendance on days student was absent
    absent_dates = [r.get('session_date') for r in student_data if r.get('status') == 'absent']
    
    if class_data and 'sessions' in class_data and absent_dates:
        class_att_on_absent_days = []
        for date in absent_dates:
            session_info = class_data['sessions'].get(date, {})
            total_students = session_info.get('total_students', 0)
            present_students = session_info.get('present_count', 0)
            
            if total_students > 0:
                day_attendance = (present_students / total_students * 100)
                class_att_on_absent_days.append(day_attendance)
        
        class_attendance_on_absent_days = np.mean(class_att_on_absent_days) if class_att_on_absent_days else 75
    else:
        class_attendance_on_absent_days = 75  # Default
    
    # Calculate peer rank percentile
    if class_data and 'students' in class_data:
        all_attendances = []
        for student in class_data['students']:
            s_total = len(student.get('records', []))
            s_present = sum(1 for r in student.get('records', []) if r.get('status') == 'present')
            s_attendance = (s_present / s_total * 100) if s_total > 0 else 0
            all_attendances.append(s_attendance)
        
        all_attendances.sort()
        rank = sum(1 for att in all_attendances if att < current_attendance)
        peer_rank_percentile = (rank / len(all_attendances) * 100) if all_attendances else 50
    else:
        peer_rank_percentile = 50  # Default (middle)
    
    # Below class average flag
    below_class_average = 1 if current_attendance < class_average_attendance else 0
    
    # NEW FEATURE 11: Relative Performance Trend (improving/declining vs peers)
    if class_data and 'students' in class_data and total_sessions >= 10:
        # Calculate if student is improving/declining relative to class
        # Compare first half vs second half performance relative to class
        
        # Student's trend
        first_half = student_data[:total_sessions//2]
        second_half = student_data[total_sessions//2:]
        
        student_first_rate = sum(1 for r in first_half if r.get('status') == 'present') / len(first_half) * 100
        student_second_rate = sum(1 for r in second_half if r.get('status') == 'present') / len(second_half) * 100
        student_trend_value = student_second_rate - student_first_rate
        
        # Class trend
        class_first_rates = []
        class_second_rates = []
        for student in class_data['students']:
            records = student.get('records', [])
            if len(records) >= 10:
                s_first = records[:len(records)//2]
                s_second = records[len(records)//2:]
                
                first_rate = sum(1 for r in s_first if r.get('status') == 'present') / len(s_first) * 100
                second_rate = sum(1 for r in s_second if r.get('status') == 'present') / len(s_second) * 100
                
                class_first_rates.append(first_rate)
                class_second_rates.append(second_rate)
        
        if class_first_rates and class_second_rates:
            class_trend_value = np.mean(class_second_rates) - np.mean(class_first_rates)
            
            # Relative performance trend
            if student_trend_value > 0 and student_vs_class_difference > 0:
                relative_performance_trend = 1.0  # Improving and above average
            elif student_trend_value > 0:
                relative_performance_trend = 0.5  # Improving but below average
            elif student_trend_value < 0 and student_vs_class_difference < 0:
                relative_performance_trend = -1.0  # Declining and below average
            elif student_trend_value < 0:
                relative_performance_trend = -0.5  # Declining but above average
            else:
                relative_performance_trend = 0.0  # Stable
        else:
            relative_performance_trend = 0.0
    else:
        relative_performance_trend = 0.0
    
    features.extend([
        class_average_attendance,        # 40
        student_vs_class_difference,     # 41
        class_attendance_on_absent_days, # 42
        peer_rank_percentile,            # 43
        below_class_average,             # 44
        relative_performance_trend       # 45 - NEW!
    ])
    
    return features


# ============================================================================
# RISK PREDICTION
# ============================================================================

def predict_risk(features):
    """
    Predict risk level using trained Random Forest model
    
    Args:
        features: List of 45 feature values
    
    Returns:
        Dictionary with risk prediction and probabilities
    """
    # Reshape features for prediction
    features_array = np.array(features).reshape(1, -1)
    
    # Get prediction
    risk_class = MODEL.predict(features_array)[0]
    risk_probabilities = MODEL.predict_proba(features_array)[0]
    
    # Map probabilities to risk levels
    # Classes are sorted alphabetically: ['high', 'low', 'moderate']
    class_labels = MODEL.classes_
    probability_dict = {
        label: float(prob) 
        for label, prob in zip(class_labels, risk_probabilities)
    }
    
    # Get confidence (highest probability)
    confidence = float(max(risk_probabilities))
    
    return {
        'risk': risk_class,
        'probability': probability_dict,
        'confidence': confidence
    }


def generate_recommendations(features, risk_result):
    """
    Generate actionable recommendations based on risk prediction
    
    Args:
        features: List of 45 feature values
        risk_result: Risk prediction result
    
    Returns:
        Dictionary with recommendations and action plan
    """
    current_attendance = features[0]
    recovery_possible = features[26]
    sessions_needed = features[27]
    sessions_remaining = features[24]
    best_possible = features[25]
    
    recommendations = []
    action_plan = ""
    
    # Check if recovery is possible
    if recovery_possible == 0:
        recommendations.append("⚠️ CRITICAL: Recovery to 75% is mathematically impossible")
        recommendations.append(f"Even with 100% attendance, maximum possible is {best_possible:.1f}%")
        action_plan = "Immediate intervention required. Consider alternative assessment or remedial options."
    
    elif current_attendance < 75:
        recommendations.append("⚠️ Currently below 75% threshold")
        recommendations.append(f"Need to attend {sessions_needed} out of {sessions_remaining} remaining sessions")
        
        required_percentage = (sessions_needed / sessions_remaining * 100) if sessions_remaining > 0 else 100
        
        if required_percentage >= 90:
            recommendations.append("🔴 Recovery is very difficult - requires near-perfect attendance")
            action_plan = f"Must attend at least {sessions_needed} sessions. Missing even 1-2 classes may result in failure."
        elif required_percentage >= 70:
            recommendations.append("🟡 Recovery is challenging but achievable with commitment")
            action_plan = f"Attend {sessions_needed} out of next {sessions_remaining} sessions to reach 75%."
        else:
            recommendations.append("🟢 Recovery is achievable with consistent attendance")
            action_plan = f"Attend {sessions_needed} more sessions to safely reach 75% threshold."
    
    else:
        # Currently above 75%
        buffer = current_attendance - 75
        max_absences = int((buffer / 100) * sessions_remaining)
        
        recommendations.append(f"✅ Currently above 75% threshold ({current_attendance:.1f}%)")
        recommendations.append(f"Can afford to miss up to {max_absences} more sessions")
        action_plan = f"Maintain current attendance pattern. Buffer: {buffer:.1f}%"
    
    return {
        'recommendations': recommendations,
        'action_plan': action_plan
    }


def analyze_risk(student_data, model1_result, model3_result, model4_result, class_data=None, total_sessions_planned=80):
    """
    Main function to analyze student attendance risk
    
    Args:
        student_data: List of attendance records
            Each record: {
                status: 'present' or 'absent',
                reason_type: 'Medical' or null,
                session_date: '2024-01-01',
                attentiveness: 'High'/'Medium'/'Low' (optional),
                emotion: 'happy'/'sad'/etc. (optional)
            }
        model1_result: Result from Model 1 (Trend Analysis)
            { trend: 'improving'/'stable'/'declining', features: {...} }
        model3_result: Result from Model 3 (Consistency Analysis)
            { consistency: 'regular'/'moderately_irregular'/'highly_irregular', features: {...} }
        model4_result: Result from Model 4 (Attentiveness Analysis)
            { attentiveness: 'actively_attentive'/'moderately_attentive'/'passively_attentive', features: {...} }
        class_data: Optional class-level data for peer comparison
            {
                sessions: {'date': {total_students, present_count, absent_count}},
                students: [{id, records: [...]}]
            }
        total_sessions_planned: Total sessions expected in semester (default: 50)
    
    Returns:
        Dictionary with risk analysis results
    """
    # ========================================================================
    # EDGE CASE 1: Zero Sessions (No Data)
    # ========================================================================
    if not student_data or len(student_data) == 0:
        return {
            'status': 'no_data',
            'risk': None,
            'probability': None,
            'confidence': None,
            'message': 'No attendance data available yet. Risk analysis requires at least 5 sessions.',
            'sessions_analyzed': 0,
            'sessions_remaining': total_sessions_planned,
            'recovery_possible': True,
            'recommendations': [
                'No attendance records found',
                'Student has not attended any sessions yet',
                'Risk analysis will be available after 5 sessions'
            ],
            'action_plan': 'Ensure student attends upcoming sessions. Early attendance is crucial.',
            'model_accuracy': MODEL_ACCURACY
        }
    
    # ========================================================================
    # EDGE CASE 2: 1-4 Sessions (Insufficient Data)
    # ========================================================================
    if len(student_data) < 5:
        # Calculate basic stats
        present_count = sum(1 for r in student_data if r.get('status') == 'present')
        current_attendance = (present_count / len(student_data) * 100) if len(student_data) > 0 else 0
        sessions_remaining = total_sessions_planned - len(student_data)
        
        # Calculate best possible
        best_possible = ((present_count + sessions_remaining) / total_sessions_planned * 100)
        recovery_possible = best_possible >= 75
        
        # Determine early risk based on current attendance
        if current_attendance >= 80:
            early_risk = 'low'
            message = f'Good start with {current_attendance:.1f}% attendance. Continue this pattern.'
        elif current_attendance >= 60:
            early_risk = 'moderate'
            message = f'Moderate attendance ({current_attendance:.1f}%). Improvement recommended.'
        else:
            early_risk = 'high'
            message = f'Low attendance ({current_attendance:.1f}%). Immediate attention needed.'
        
        return {
            'status': 'early_stage',
            'risk': early_risk,
            'probability': None,
            'confidence': 'none',
            'message': f'Only {len(student_data)} sessions recorded. Need at least 5 sessions for reliable ML prediction. Showing early assessment.',
            'current_attendance': current_attendance,
            'sessions_analyzed': len(student_data),
            'sessions_remaining': sessions_remaining,
            'best_possible_attendance': best_possible,
            'recovery_possible': recovery_possible,
            'recommendations': [
                f'Early stage: {len(student_data)} sessions completed',
                message,
                f'Can still achieve {best_possible:.1f}% if pattern improves'
            ],
            'action_plan': f'Attend consistently. {sessions_remaining} sessions remaining to establish good pattern.',
            'model_accuracy': MODEL_ACCURACY
        }
    
    # ========================================================================
    # FULL ANALYSIS: 5+ Sessions
    # ========================================================================
    
    # Extract features
    features = extract_features(student_data, model1_result, model3_result, model4_result, class_data, total_sessions_planned)
    
    # Predict risk
    risk_result = predict_risk(features)
    
    # Generate recommendations
    recommendations = generate_recommendations(features, risk_result)
    
    # Build result
    result = {
        'status': 'analyzed',
        'risk': risk_result['risk'],
        'probability': risk_result['probability'],
        'confidence': risk_result['confidence'],
        'current_attendance': features[0],
        'best_possible_attendance': features[25],
        'recovery_possible': features[26] == 1,
        'sessions_needed_to_reach_75': int(features[27]),
        'sessions_remaining': int(features[24]),
        'recommendations': recommendations['recommendations'],
        'action_plan': recommendations['action_plan'],
        'model_accuracy': MODEL_ACCURACY,
        'sessions_analyzed': len(student_data),
        'features_used': len(features)
    }
    
    return result


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def main():
    """
    Main entry point for the script
    Reads JSON from stdin and outputs risk analysis results
    
    Expected Input Format:
    {
        "student_data": [
            {
                "status": "present" or "absent",
                "reason_type": "Medical" or null,
                "session_date": "2024-01-01",
                "attentiveness": "High"/"Medium"/"Low" (optional),
                "emotion": "happy"/"sad"/etc. (optional)
            }
        ],
        "model1_result": {
            "trend": "improving"/"stable"/"declining",
            "features": {...}
        },
        "model3_result": {
            "consistency": "regular"/"moderately_irregular"/"highly_irregular",
            "features": {...}
        },
        "model4_result": {
            "attentiveness": "actively_attentive"/"moderately_attentive"/"passively_attentive",
            "features": {...}
        },
        "class_data": {
            "sessions": {
                "2024-01-01": {
                    "total_students": 50,
                    "present_count": 45,
                    "absent_count": 5
                }
            },
            "students": [
                {
                    "id": 1,
                    "records": [...]
                }
            ]
        },
        "total_sessions_planned": 50
    }
    """
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        student_data = data.get('student_data', [])
        model1_result = data.get('model1_result', {})
        model3_result = data.get('model3_result', {})
        model4_result = data.get('model4_result', {})
        class_data = data.get('class_data', None)
        total_sessions_planned = data.get('total_sessions_planned', 80)
        
        # Perform risk analysis
        result = analyze_risk(
            student_data, 
            model1_result, 
            model3_result, 
            model4_result, 
            class_data,
            total_sessions_planned
        )
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            'status': 'error',
            'risk': None,
            'probability': None,
            'confidence': None,
            'message': f'Risk analysis failed: {str(e)}',
            'error': str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()

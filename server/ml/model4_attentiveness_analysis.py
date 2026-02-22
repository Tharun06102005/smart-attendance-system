"""
Model 4: Attentiveness Level Analysis
Analyzes student engagement using face recognition data (attentiveness + emotion)
Priority: Face recognition FIRST, consistency ONLY for borderline cases
"""

import sys
import json
import numpy as np
from datetime import datetime

def calculate_attentiveness_features(attendance_data):
    """
    Extract features from attendance data with attentiveness and emotion
    
    Args:
        attendance_data: List of attendance records with attentiveness and emotion
    
    Returns:
        Dictionary of calculated features
    """
    # Filter only present sessions with valid attentiveness data
    present_sessions = [
        record for record in attendance_data 
        if record.get('status') == 'present' 
        and record.get('attentiveness') is not None
        and record.get('emotion') is not None
    ]
    
    total_present = len(present_sessions)
    
    if total_present == 0:
        return {
            'total_present_sessions': 0,
            'data_quality_score': 0,
            'high_attentiveness_ratio': 0,
            'medium_attentiveness_ratio': 0,
            'low_attentiveness_ratio': 0,
            'positive_emotion_ratio': 0,
            'neutral_emotion_ratio': 0,
            'negative_emotion_ratio': 0,
            'average_attentiveness_score': 0,
            'attentiveness_consistency': 0
        }
    
    # Count attentiveness levels
    high_count = sum(1 for r in present_sessions if r.get('attentiveness') == 'High')
    medium_count = sum(1 for r in present_sessions if r.get('attentiveness') == 'Medium')
    low_count = sum(1 for r in present_sessions if r.get('attentiveness') == 'Low')
    
    # Count emotion types
    positive_emotions = ['happy', 'surprise']
    neutral_emotions = ['neutral']
    negative_emotions = ['sad', 'angry', 'fear', 'disgust']
    
    positive_count = sum(1 for r in present_sessions if r.get('emotion') in positive_emotions)
    neutral_count = sum(1 for r in present_sessions if r.get('emotion') in neutral_emotions)
    negative_count = sum(1 for r in present_sessions if r.get('emotion') in negative_emotions)
    
    # Calculate ratios
    high_ratio = high_count / total_present
    medium_ratio = medium_count / total_present
    low_ratio = low_count / total_present
    
    positive_ratio = positive_count / total_present
    neutral_ratio = neutral_count / total_present
    negative_ratio = negative_count / total_present
    
    # Calculate average attentiveness score (High=3, Medium=2, Low=1)
    attentiveness_scores = []
    for record in present_sessions:
        att = record.get('attentiveness')
        if att == 'High':
            attentiveness_scores.append(3)
        elif att == 'Medium':
            attentiveness_scores.append(2)
        elif att == 'Low':
            attentiveness_scores.append(1)
    
    avg_score = np.mean(attentiveness_scores) if attentiveness_scores else 0
    std_score = np.std(attentiveness_scores) if len(attentiveness_scores) > 1 else 0
    
    # Data quality score (how many present sessions have attentiveness data)
    total_sessions = len(attendance_data)
    data_quality = total_present / total_sessions if total_sessions > 0 else 0
    
    return {
        'total_present_sessions': total_present,
        'data_quality_score': data_quality,
        'high_attentiveness_ratio': high_ratio,
        'medium_attentiveness_ratio': medium_ratio,
        'low_attentiveness_ratio': low_ratio,
        'positive_emotion_ratio': positive_ratio,
        'neutral_emotion_ratio': neutral_ratio,
        'negative_emotion_ratio': negative_ratio,
        'average_attentiveness_score': avg_score,
        'attentiveness_consistency': std_score
    }

def calculate_confidence(features):
    """
    Calculate confidence level based on data quality and quantity
    
    Returns: 'none', 'low', 'medium', or 'high'
    """
    confidence_score = 100
    
    # Reduce confidence based on sample size
    if features['total_present_sessions'] < 10:
        confidence_score -= 30
    elif features['total_present_sessions'] < 20:
        confidence_score -= 15
    
    # Reduce confidence for poor data quality
    if features['data_quality_score'] < 0.8:
        confidence_score -= 20
    
    # Reduce confidence for high variance (inconsistent behavior)
    if features['attentiveness_consistency'] > 0.8:
        confidence_score -= 15
    
    # Map to confidence levels
    if confidence_score >= 75:
        return 'high'
    elif confidence_score >= 50:
        return 'medium'
    elif confidence_score >= 30:
        return 'low'
    else:
        return 'none'

def classify_attentiveness(features, consistency_from_model3=None):
    """
    Classify attentiveness level with priority logic:
    1. Face recognition (attentiveness + emotion) is PRIMARY
    2. Consistency is ONLY used for moderate/low cases
    
    Args:
        features: Dictionary of calculated features
        consistency_from_model3: Result from Model 3 ('regular', 'moderately_irregular', 'highly_irregular')
    
    Returns:
        Dictionary with classification result
    """
    
    # SAFETY GATE 1: Insufficient data
    if features['total_present_sessions'] == 0:
        return {
            'status': 'no_data',
            'attentiveness': None,
            'confidence': 'none',
            'message': 'No attendance data available yet. Attentiveness analysis requires at least 5 sessions.',
            'sessions_analyzed': 0,
            'features': features
        }
    
    if features['total_present_sessions'] < 5:
        return {
            'status': 'early_stage',
            'attentiveness': 'moderately_attentive',
            'confidence': 'none',
            'message': f'Only {features["total_present_sessions"]} sessions recorded. Need at least 5 sessions for reliable attentiveness analysis.',
            'sessions_analyzed': features['total_present_sessions'],
            'features': features
        }
    
    # SAFETY GATE 2: Poor data quality
    if features['data_quality_score'] < 0.6:
        return {
            'status': 'low_quality_data',
            'attentiveness': 'moderately_attentive',
            'confidence': 'low',
            'message': 'Face recognition data quality is insufficient for reliable analysis. Manual verification recommended.',
            'sessions_analyzed': features['total_present_sessions'],
            'features': features
        }
    
    # STEP 1: Calculate face recognition score (PRIMARY indicator)
    # Attentiveness and emotion are SAME - both from face recognition
    high_ratio = features['high_attentiveness_ratio']
    positive_emotion_ratio = features['positive_emotion_ratio']
    
    face_score = (high_ratio * 0.5) + (positive_emotion_ratio * 0.5)
    
    # STEP 2: Initial classification based on face recognition ONLY
    if face_score >= 0.70:
        # HIGH ENGAGEMENT - This is final, don't check consistency
        return {
            'status': 'analyzed',
            'attentiveness': 'actively_attentive',
            'confidence': calculate_confidence(features),
            'face_score': round(face_score, 3),
            'consistency_checked': False,
            'reason': 'High engagement detected through face recognition',
            'interpretation': 'Student shows high engagement with predominantly positive emotions during class.',
            'sessions_analyzed': features['total_present_sessions'],
            'features': features
        }
    
    elif face_score >= 0.40:
        # MODERATE ENGAGEMENT - Check consistency for possible upgrade
        consistency_checked = True
        
        if consistency_from_model3 == 'regular' and face_score >= 0.50:
            # Upgrade to actively attentive
            final_classification = 'actively_attentive'
            reason = 'Moderate-high engagement + regular attendance'
            interpretation = 'Student shows consistent attendance and good engagement. Reliable and committed learner.'
        else:
            # Keep as moderately attentive
            final_classification = 'moderately_attentive'
            if consistency_from_model3 == 'highly_irregular':
                reason = 'Moderate engagement but irregular attendance'
                interpretation = 'Student shows moderate engagement when present, but attendance pattern is irregular.'
            else:
                reason = 'Moderate engagement with acceptable attendance'
                interpretation = 'Student shows moderate engagement and acceptable attendance pattern.'
        
        return {
            'status': 'analyzed',
            'attentiveness': final_classification,
            'confidence': calculate_confidence(features),
            'face_score': round(face_score, 3),
            'consistency_checked': consistency_checked,
            'consistency_from_model3': consistency_from_model3,
            'reason': reason,
            'interpretation': interpretation,
            'sessions_analyzed': features['total_present_sessions'],
            'features': features
        }
    
    else:  # face_score < 0.40
        # LOW ENGAGEMENT - Check consistency to confirm or soften
        consistency_checked = True
        
        if consistency_from_model3 == 'regular' and face_score >= 0.30:
            # Student comes regularly but low engagement
            # Give benefit of doubt - upgrade to moderate
            final_classification = 'moderately_attentive'
            reason = 'Low engagement but regular attendance - may be shy/introverted'
            interpretation = 'Student attends regularly but shows lower engagement. May be naturally reserved or introverted.'
        else:
            # Confirm passively attentive
            final_classification = 'passively_attentive'
            if consistency_from_model3 == 'highly_irregular':
                reason = 'Low engagement combined with irregular attendance'
                interpretation = 'Student shows low engagement and irregular attendance pattern. May need additional support.'
            else:
                reason = 'Low engagement detected through face recognition'
                interpretation = 'Student shows lower engagement levels during class sessions.'
        
        return {
            'status': 'analyzed',
            'attentiveness': final_classification,
            'confidence': calculate_confidence(features),
            'face_score': round(face_score, 3),
            'consistency_checked': consistency_checked,
            'consistency_from_model3': consistency_from_model3,
            'reason': reason,
            'interpretation': interpretation,
            'sessions_analyzed': features['total_present_sessions'],
            'features': features
        }

def analyze_attentiveness(attendance_data, consistency_from_model3=None):
    """
    Main function to analyze student attentiveness
    
    Args:
        attendance_data: List of attendance records
        consistency_from_model3: Optional consistency result from Model 3
    
    Returns:
        Dictionary with analysis results
    """
    # Calculate features
    features = calculate_attentiveness_features(attendance_data)
    
    # Classify attentiveness
    result = classify_attentiveness(features, consistency_from_model3)
    
    return result

def main():
    """
    Main entry point for the script
    Reads JSON from stdin and outputs analysis results
    """
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        attendance_data = data.get('attendance_data', [])
        consistency_from_model3 = data.get('consistency_from_model3', None)
        
        # Perform analysis
        result = analyze_attentiveness(attendance_data, consistency_from_model3)
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            'status': 'error',
            'attentiveness': None,
            'confidence': 'none',
            'message': f'Analysis failed: {str(e)}',
            'error': str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()

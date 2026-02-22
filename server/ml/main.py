"""
Optimized Face Recognition ML Service
Attendance System - FastAPI Backend
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import uvicorn
import numpy as np
import cv2
from PIL import Image
import io
import json
import base64
from deepface import DeepFace
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Face Recognition ML Service",
    description="Optimized face recognition for attendance system",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model cache
MODEL_CACHE = {}
FACE_DETECTOR = "retinaface"  # Better for group detection and various angles
RECOGNITION_MODEL = "Facenet512"  # 512-dimensional embeddings
SIMILARITY_THRESHOLD = 0.4  # Cosine similarity threshold (0-1) - Lowered for better recognition across different images

# ============================================================================
# STARTUP: PRE-LOAD MODELS
# ============================================================================

@app.on_event("startup")
async def load_models():
    """Pre-load ML models at startup for faster inference"""
    logger.info("🚀 Loading ML models...")
    try:
        # Create dummy image for model initialization
        dummy_img = np.zeros((160, 160, 3), dtype=np.uint8)
        
        # Pre-load FaceNet512 model
        logger.info("Loading FaceNet512 model...")
        DeepFace.represent(
            dummy_img,
            model_name=RECOGNITION_MODEL,
            enforce_detection=False,
            detector_backend="skip"
        )
        MODEL_CACHE['facenet'] = True
        logger.info("✅ FaceNet512 loaded")
        
        # Pre-load face detector
        logger.info(f"Loading {FACE_DETECTOR} detector...")
        DeepFace.extract_faces(
            dummy_img,
            detector_backend=FACE_DETECTOR,
            enforce_detection=False
        )
        MODEL_CACHE['detector'] = True
        logger.info(f"✅ {FACE_DETECTOR} loaded")
        
        # Pre-load emotion model
        logger.info("Loading emotion detection model...")
        DeepFace.analyze(
            dummy_img,
            actions=['emotion'],
            enforce_detection=False,
            detector_backend="skip"
        )
        MODEL_CACHE['emotion'] = True
        logger.info("✅ Emotion model loaded")
        
        logger.info("🎉 All models loaded successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error loading models: {e}")

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Face Recognition ML Service",
        "version": "1.0.0",
        "models_loaded": len(MODEL_CACHE),
        "models": list(MODEL_CACHE.keys()),
        "timestamp": datetime.now().isoformat()
    }

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def process_image(image_bytes: bytes) -> np.ndarray:
    """Convert image bytes to numpy array"""
    try:
        # Open image with PIL
        pil_img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        # Convert to numpy array
        img_array = np.array(pil_img)
        
        return img_array
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise HTTPException(status_code=400, detail="Invalid image format")

def calculate_cosine_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    """Calculate cosine similarity between two embeddings"""
    # Normalize embeddings
    norm1 = np.linalg.norm(embedding1)
    norm2 = np.linalg.norm(embedding2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    # Calculate cosine similarity
    similarity = np.dot(embedding1, embedding2) / (norm1 * norm2)
    return float(similarity)

def draw_bounding_box(img: np.ndarray, face_area: dict, label: str, color: tuple, confidence: float):
    """Draw bounding box and label on image"""
    x = int(face_area.get('x', 0))
    y = int(face_area.get('y', 0))
    w = int(face_area.get('w', 0))
    h = int(face_area.get('h', 0))
    
    # Add padding
    padding = 0.1
    pad_x = int(w * padding)
    pad_y = int(h * padding)
    
    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = x + w + pad_x
    y2 = y + h + pad_y
    
    # Draw rectangle
    cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
    
    # Draw label background
    label_text = f"{label} ({confidence:.2f})"
    (text_width, text_height), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.rectangle(img, (x1, y1 - text_height - 10), (x1 + text_width, y1), color, -1)
    
    # Draw label text
    cv2.putText(img, label_text, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

# ============================================================================
# REGISTRATION ENDPOINT
# ============================================================================

@app.post("/register")
async def register_student(request: Request):
    """
    Register a student with face embedding
    
    Process:
    1. Receive student image as base64
    2. Detect face (select highest confidence if multiple)
    3. Generate 512-dim embedding using FaceNet512
    4. Return embedding for storage in database
    """
    try:
        # Parse JSON body
        body = await request.json()
        student_id = body.get('student_id')
        name = body.get('name')
        image_base64 = body.get('image_base64')
        
        if not student_id or not name or not image_base64:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        logger.info(f"📝 Registering student: {student_id} - {name}")
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_base64)
            pil_img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            img_array = np.array(pil_img)
        except Exception as e:
            logger.error(f"Error decoding image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        logger.info(f"Image shape: {img_array.shape}")
        
        # Detect faces
        faces = DeepFace.extract_faces(
            img_array,
            detector_backend=FACE_DETECTOR,
            enforce_detection=False,
            align=True,
            expand_percentage=20  # Expand face region by 20% for better context
        )
        
        if not faces or len(faces) == 0:
            logger.warning("No face detected in image")
            raise HTTPException(
                status_code=400,
                detail="No face detected in image. Please provide a clear face photo with good lighting."
            )
        
        logger.info(f"Detected {len(faces)} face(s)")
        
        # If multiple faces, select the one with highest confidence
        if len(faces) > 1:
            logger.info("Multiple faces detected, selecting highest confidence face")
            faces = sorted(faces, key=lambda x: x.get('confidence', 0), reverse=True)
        
        selected_face = faces[0]
        face_confidence = selected_face.get('confidence', 0)
        logger.info(f"Selected face with confidence: {face_confidence:.4f}")
        
        # Extract face region
        facial_area = selected_face.get('facial_area', {})
        x = int(facial_area.get('x', 0))
        y = int(facial_area.get('y', 0))
        w = int(facial_area.get('w', 0))
        h = int(facial_area.get('h', 0))
        
        if w < 20 or h < 20:  # Reduced threshold for smaller faces
            raise HTTPException(
                status_code=400,
                detail="Face too small. Please provide a closer, clearer image."
            )
        
        face_crop = img_array[y:y+h, x:x+w]
        
        # Generate embedding
        logger.info("Generating face embedding...")
        embedding_result = DeepFace.represent(
            face_crop,
            model_name=RECOGNITION_MODEL,
            enforce_detection=False,
            detector_backend="skip",
            align=True,
            normalization='base'  # Normalize face for better consistency
        )
        
        embedding = embedding_result[0]['embedding']
        embedding_array = np.array(embedding, dtype=np.float32)
        
        # Normalize the embedding for better comparison
        norm = np.linalg.norm(embedding_array)
        if norm > 0:
            embedding_array = embedding_array / norm
        
        logger.info(f"✅ Embedding generated: {len(embedding_array)} dimensions")
        
        # Convert embedding to JSON-serializable list
        embedding_list = embedding_array.tolist()
        
        return {
            "success": True,
            "student_id": student_id,
            "name": name,
            "embedding": embedding_list,
            "embedding_dimensions": len(embedding_list),
            "face_confidence": float(face_confidence),
            "message": "Student registered successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

# ============================================================================
# RECOGNITION ENDPOINT
# ============================================================================

@app.post("/recognize")
async def recognize_faces(request: Request):
    """
    Recognize faces in multiple classroom images
    
    Process:
    1. Receive multiple classroom images as base64
    2. Parse enrolled students with embeddings
    3. For each image:
       - Detect all faces
       - Generate embeddings for each face
       - Compare with enrolled students
       - Mark matches above threshold
    4. Aggregate results (student in ANY image = present)
    5. Return recognized students with confidence scores
    """
    try:
        # Parse JSON body
        body = await request.json()
        images_base64 = body.get('images', [])
        students_data = body.get('enrolled_students', [])
        
        logger.info(f"🔍 Starting recognition for {len(images_base64)} image(s)")
        
        if not images_base64:
            raise HTTPException(status_code=400, detail="No images provided")
        
        if not students_data:
            raise HTTPException(status_code=400, detail="No enrolled students provided")
        
        logger.info(f"Enrolled students: {len(students_data)}")
        
        # Prepare student embeddings
        student_embeddings = []
        student_map = []
        
        for student in students_data:
            if 'embedding' in student and student['embedding']:
                try:
                    emb = np.array(student['embedding'], dtype=np.float32)
                    # Normalize stored embeddings for consistent comparison
                    norm = np.linalg.norm(emb)
                    if norm > 0:
                        emb = emb / norm
                    student_embeddings.append(emb)
                    student_map.append(student)
                except Exception as e:
                    logger.warning(f"Invalid embedding for {student.get('usn', 'unknown')}: {e}")
        
        if not student_embeddings:
            raise HTTPException(status_code=400, detail="No valid student embeddings found")
        
        student_embeddings = np.array(student_embeddings)
        logger.info(f"Prepared {len(student_embeddings)} valid embeddings")
        
        # Track recognized students across all images
        recognized_students = {}  # usn -> {name, confidence, emotion}
        all_faces_detected = 0
        processed_images = []
        
        # Process each image
        for img_idx, image_base64 in enumerate(images_base64):
            logger.info(f"Processing image {img_idx + 1}/{len(images_base64)}")
            
            # Decode base64 image
            try:
                image_bytes = base64.b64decode(image_base64)
                pil_img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
                img_array = np.array(pil_img)
            except Exception as e:
                logger.error(f"Error decoding image {img_idx + 1}: {e}")
                continue
            img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
            # Detect faces
            faces = DeepFace.extract_faces(
                img_array,
                detector_backend=FACE_DETECTOR,
                enforce_detection=False,
                align=True,
                expand_percentage=20  # Expand face region by 20% for better context
            )
            
            logger.info(f"Detected {len(faces)} face(s) in image {img_idx + 1}")
            all_faces_detected += len(faces)
            
            # Process each detected face
            for face_idx, face_data in enumerate(faces):
                logger.info(f"Processing face {face_idx + 1}/{len(faces)}")
                facial_area = face_data.get('facial_area', {})
                x = int(facial_area.get('x', 0))
                y = int(facial_area.get('y', 0))
                w = int(facial_area.get('w', 0))
                h = int(facial_area.get('h', 0))
                
                logger.info(f"Face {face_idx + 1} dimensions: x={x}, y={y}, w={w}, h={h}")
                
                if w < 20 or h < 20:  # Reduced from 30 to 20 to detect smaller faces
                    logger.info(f"Face {face_idx + 1} too small (w={w}, h={h}), skipping")
                    continue
                
                face_crop = img_array[y:y+h, x:x+w]
                
                if face_crop.size == 0:
                    continue
                
                try:
                    # Generate embedding for detected face
                    embedding_result = DeepFace.represent(
                        face_crop,
                        model_name=RECOGNITION_MODEL,
                        enforce_detection=False,
                        detector_backend="skip",
                        align=True,
                        normalization='base'  # Normalize face for better consistency
                    )
                    
                    face_embedding = np.array(embedding_result[0]['embedding'], dtype=np.float32)
                    
                    # Normalize the embedding for better comparison
                    norm = np.linalg.norm(face_embedding)
                    if norm > 0:
                        face_embedding = face_embedding / norm
                    
                    # Calculate similarities with all enrolled students
                    similarities = []
                    for student_emb in student_embeddings:
                        sim = calculate_cosine_similarity(face_embedding, student_emb)
                        similarities.append(sim)
                    
                    similarities = np.array(similarities)
                    best_idx = np.argmax(similarities)
                    best_score = float(similarities[best_idx])
                    
                    logger.info(f"Face {face_idx + 1}: Best match = {student_map[best_idx]['name']} (score: {best_score:.4f})")
                    
                    # Check if match is above threshold
                    if best_score >= SIMILARITY_THRESHOLD:
                        matched_student = student_map[best_idx]
                        usn = matched_student['usn']
                        
                        # Try to detect emotion and map to attentiveness
                        attentiveness = 'Medium'  # Default
                        emotion = 'neutral'  # Default
                        try:
                            logger.info(f"Attempting emotion detection for face {face_idx + 1}...")
                            emotion_result = DeepFace.analyze(
                                face_crop,
                                actions=['emotion'],
                                enforce_detection=False,
                                detector_backend="skip"
                            )
                            if isinstance(emotion_result, list):
                                emotion_result = emotion_result[0]
                            emotion = emotion_result.get('dominant_emotion', 'neutral')
                            
                            # Map emotion to attentiveness level
                            # High attentiveness: happy, surprise (engaged, interested)
                            # Medium attentiveness: neutral (paying attention but not expressive)
                            # Low attentiveness: sad, angry, fear, disgust (distracted, disengaged)
                            if emotion in ['happy', 'surprise']:
                                attentiveness = 'High'
                            elif emotion in ['neutral']:
                                attentiveness = 'Medium'
                            else:  # sad, angry, fear, disgust
                                attentiveness = 'Low'
                            
                            logger.info(f"✅ Emotion detected: {emotion} → Attentiveness: {attentiveness}")
                        except Exception as e:
                            logger.warning(f"⚠️ Emotion detection failed: {e}, using defaults")
                            attentiveness = 'Medium'
                            emotion = 'neutral'
                        
                        # Emotion priority levels (higher is better)
                        emotion_priority = {
                            'happy': 5,
                            'surprise': 4,
                            'neutral': 3,
                            'sad': 2,
                            'fear': 1,
                            'angry': 1,
                            'disgust': 1
                        }
                        
                        # Update recognized student
                        # Priority: Keep the most positive emotion (highest priority)
                        # If same priority, keep higher confidence
                        if usn not in recognized_students:
                            recognized_students[usn] = {
                                'usn': usn,
                                'name': matched_student['name'],
                                'confidence': best_score,
                                'attentiveness': attentiveness,
                                'emotion': emotion
                            }
                            logger.info(f"✅ Recognized: {matched_student['name']} (confidence: {best_score:.4f}, emotion: {emotion}, attentiveness: {attentiveness})")
                        else:
                            # Student already detected, compare emotions
                            existing_emotion = recognized_students[usn]['emotion']
                            existing_priority = emotion_priority.get(existing_emotion, 0)
                            new_priority = emotion_priority.get(emotion, 0)
                            
                            # Keep the more positive emotion, or higher confidence if same emotion
                            if new_priority > existing_priority:
                                recognized_students[usn]['emotion'] = emotion
                                recognized_students[usn]['attentiveness'] = attentiveness
                                recognized_students[usn]['confidence'] = max(best_score, recognized_students[usn]['confidence'])
                                logger.info(f"🔄 Updated {matched_student['name']}: {existing_emotion} → {emotion} (more positive)")
                            elif new_priority == existing_priority and best_score > recognized_students[usn]['confidence']:
                                recognized_students[usn]['confidence'] = best_score
                                logger.info(f"🔄 Updated {matched_student['name']}: confidence {recognized_students[usn]['confidence']:.4f} → {best_score:.4f}")
                            else:
                                logger.info(f"ℹ️ Keeping existing emotion for {matched_student['name']}: {existing_emotion} (priority {existing_priority}) vs {emotion} (priority {new_priority})")
                        
                        # Draw green box for recognized
                        draw_bounding_box(img_bgr, facial_area, matched_student['name'], (0, 255, 0), best_score)
                    else:
                        # Draw red box for unrecognized
                        draw_bounding_box(img_bgr, facial_area, "Unknown", (0, 0, 255), best_score)
                        logger.info(f"❌ Face {face_idx + 1} below threshold ({best_score:.4f} < {SIMILARITY_THRESHOLD}) - Best match: {student_map[best_idx]['name']}")
                
                except Exception as e:
                    logger.error(f"Error processing face {face_idx + 1}: {e}")
                    continue
            
            # Add timestamp to the annotated image
            timestamp = datetime.now().strftime("%b %d, %Y %I:%M:%S %p")
            logger.info(f"📅 Adding timestamp to image: {timestamp}")
            
            # Get image dimensions
            img_height, img_width = img_bgr.shape[:2]
            
            # Add timestamp at top-right corner
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.7
            font_thickness = 2
            text_color = (255, 255, 255)  # White
            bg_color = (0, 0, 0)  # Black background
            
            # Get text size
            (text_width, text_height), baseline = cv2.getTextSize(timestamp, font, font_scale, font_thickness)
            
            # Position at top-right with padding
            padding = 10
            x = img_width - text_width - padding
            y = padding + text_height
            
            # Draw black background rectangle
            cv2.rectangle(img_bgr, 
                         (x - 5, y - text_height - 5), 
                         (x + text_width + 5, y + baseline + 5), 
                         bg_color, -1)
            
            # Draw white text
            cv2.putText(img_bgr, timestamp, (x, y), font, font_scale, text_color, font_thickness)
            logger.info(f"✅ Timestamp added to image at position ({x}, {y})")
            
            # Encode processed image with timestamp
            _, buffer = cv2.imencode('.jpg', img_bgr)
            encoded_image = base64.b64encode(buffer).decode('utf-8')
            processed_images.append(encoded_image)
        
        # Convert recognized students to list
        recognized_list = list(recognized_students.values())
        
        logger.info(f"🎉 Recognition complete: {len(recognized_list)} students recognized out of {all_faces_detected} faces detected")
        
        return {
            "success": True,
            "recognized_students": recognized_list,
            "total_faces_detected": all_faces_detected,
            "total_students_recognized": len(recognized_list),
            "processed_images": processed_images,
            "threshold_used": SIMILARITY_THRESHOLD,
            "message": f"Recognized {len(recognized_list)} students from {len(images_base64)} image(s)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Recognition error: {e}")
        raise HTTPException(status_code=500, detail=f"Recognition failed: {str(e)}")

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    logger.info("🚀 Starting Face Recognition ML Service...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

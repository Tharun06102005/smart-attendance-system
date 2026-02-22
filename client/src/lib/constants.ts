/**
 * Academic options for filters across the application
 */

// Semesters
export const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

// Departments  
export const DEPARTMENTS = ["CS", "IS"];

// Sections
export const SECTIONS = ["A", "B"];

// Subject data organized by department and semester
export const SUBJECTS_BY_DEPT_SEMESTER = {
  CS: {
    "1": [
      "Engineering Mathematics – I",
      "Programming for Problem Solving",
      "Engineering Physics",
      "Basics of Electrical Engineering"
    ],
    "2": [
      "Engineering Mathematics – II",
      "Object Oriented Programming",
      "Engineering Chemistry",
      "Communication Skills"
    ],
    "3": [
      "Data Structures",
      "Digital Logic Design",
      "Discrete Mathematical Structures",
      "Computer Organization"
    ],
    "4": [
      "Operating Systems",
      "Database Management Systems",
      "Design & Analysis of Algorithms",
      "Software Engineering"
    ],
    "5": [
      "Cloud Computing",
      "Machine Learning",
      "Advanced Java Programming",
      "Integrated Waste Management for Smart Cities & Geographical Systems",
      "DevOps Engineering",
      "Indian Knowledge System",
      "Project Work – Phase I",
      "Machine Learning Laboratory"
    ],
    "6": [
      "Compiler Design",
      "Computer Networks",
      "Artificial Intelligence",
      "Cloud Security"
    ],
    "7": [
      "Internet of Things",
      "Cyber Security",
      "Data Science",
      "Project Management"
    ],
    "8": [
      "Big Data Analytics",
      "Mobile Application Development",
      "Advanced Elective – I",
      "Project Work – Phase II"
    ]
  },
  IS: {
    "1": [
      "Engineering Mathematics – I",
      "Programming Fundamentals",
      "Engineering Physics",
      "Environmental Studies"
    ],
    "2": [
      "Engineering Mathematics – II",
      "Object Oriented Concepts",
      "Engineering Chemistry",
      "Technical Communication"
    ],
    "3": [
      "Data Structures",
      "Digital System Design",
      "Discrete Mathematics",
      "Computer Architecture"
    ],
    "4": [
      "Operating Systems Concepts",
      "Database Systems",
      "Algorithm Analysis",
      "Software Design Principles"
    ],
    "5": [
      "Cloud Computing",
      "Machine Learning",
      "Advanced Python Programming",
      "Smart City Information Systems",
      "DevOps Engineering",
      "Indian Knowledge System",
      "Project Work – Phase I",
      "Data Analytics Laboratory"
    ],
    "6": [
      "Information Security",
      "Data Warehousing",
      "Artificial Intelligence Systems",
      "Enterprise Resource Planning"
    ],
    "7": [
      "Internet Technologies",
      "Big Data Processing",
      "Business Intelligence",
      "Software Project Planning"
    ],
    "8": [
      "Knowledge Engineering",
      "Advanced Elective – I",
      "Advanced Elective – II",
      "Project Work – Phase II"
    ]
  }
};

// Helper function to get subjects based on semester and selected departments
export const getSubjectsByDepartments = (semester: string, departments: string[]): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  
  departments.forEach(dept => {
    if (dept === "CS" || dept === "IS") {
      const deptData = SUBJECTS_BY_DEPT_SEMESTER[dept];
      if (deptData && deptData[semester as keyof typeof deptData]) {
        result[dept] = deptData[semester as keyof typeof deptData];
      }
    }
  });
  
  return result;
};

// Helper function to get subjects for a single department (CRITICAL FIX for Feature 1)
export const getSubjectsForDepartment = (semester: string, department: string): string[] => {
  if (department === "CS" || department === "IS") {
    const deptData = SUBJECTS_BY_DEPT_SEMESTER[department];
    if (deptData && deptData[semester as keyof typeof deptData]) {
      return deptData[semester as keyof typeof deptData];
    }
  }
  return [];
};

// Get all subjects as flat array (for backward compatibility)
export const ALL_SUBJECTS = Object.values(SUBJECTS_BY_DEPT_SEMESTER).flatMap(dept => 
  Object.values(dept).flat()
);

// API Configuration
export const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : '/api'; // Use proxy in development
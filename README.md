📄 System_AI-Powered-Web-Application-for-CV-Maker
An System_AI-Powered-Web-Application-for-CV-Maker that simplifies and enhances the CV creation process using artificial intelligence. Built as a senior graduation project at the University of Bahrain, this tool helps job seekers, fresh graduates, and professionals create high-quality, ATS-friendly resumes in both English and Arabic with just a few clicks.

🚀 Features:

🤖 AI Text Enhancement – Uses DeepSeek API to rewrite job descriptions, skills, and summaries in a professional tone.

🌍 Bilingual Support – Seamless switching between English and Arabic, including RTL/LTR layout adjustment.

🎨 Multiple Templates – Choose from Modern, Professional, and Classic CV templates.

📄 PDF Export – Generate and download your CV as a high-quality PDF.

🖼️ Profile Picture Upload – Add a personal photo to your CV.

✏️ Dynamic Sections – Add or remove work experience, education, and extra information blocks.

🔍 Live Preview – See real-time changes before downloading.

✅ Form Validation – Ensures required fields, valid emails, and phone numbers.


🛠️ Tech Stack

Layer	Technology
Frontend	HTML5, CSS3, Bootstrap 5, jQuery
Backend	Python, Flask
AI Integration	DeepSeek API
PDF Generation	WexPrint (HTML to PDF)
Templating	Jinja2

📁 Project Structure:
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variables template
├── templates/             # HTML templates (Jinja2)
├── static/                # CSS, JS, images
└── README.md              # Project documentation


🧪 How to Run Locally:
Make sure you have Python 3.8+ installed.

bash
# Clone the repository
git clone https://github.com/Ayman-Habib/System_AI-Powered-Web-Application-for-CV-Maker
cd System_AI-Powered-Web-Application-for-CV-Maker

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Then add your DEEPSEEK_API_KEY inside .env 

# Run the application
python app.py
Then open your browser and go to:
👉 http://127.0.0.1:5000/

Note: The Modern template uses the Helvetica font for a clean, professional look.

Supervisors: Dr. Mohammed Mazin & Dr. Aysha Al-Sayed
Academic Year: 2025–2026 – Semester 1

📌 Future Work:
More professional templates
Dark mode and drag‑and‑drop sections
Mobile application version
Improved AI prompts for smarter suggestions
Additional languages (French, Portuguese)
Direct integration with job portals (LinkedIn, Bayt)
ATS‑compatible output formatting

DeepSeek CV Generator (English default)
Run:

text
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then add your DEEPSEEK_API_KEY if you have one
python app.py
Open http://127.0.0.1:5000/

Notes: Modern template uses Helvetica.

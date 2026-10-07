# Study

Version 0.6.0 adds “Ask all weeks” next to “Ask this week” on a course page. Search concepts across the semester, compare weeks, or ask for revision priorities. Responses show the retrieved Canvas page links and reading coverage. All-week conversations are stored separately from each weekly conversation. The first request reads the course's published module pages with four concurrent requests; the index is cached in server memory for ten minutes. Relevant passages are selected within a bounded context budget. This currently indexes Canvas Page text only; PDF, PPT, DOCX and video bodies are not analysed.

A compact semester dashboard focused on the next Assessment, this week’s Canvas content, and clear learning progress across four courses.

## Start on macOS

1. Install Node.js LTS if it is not already installed.
2. If the previous version is beside this folder, the launcher automatically copies its local `.env`. Otherwise, add your Canvas Token and AI provider key to a local `.env` file (copy `.env.example` first).
3. Double-click `start-study.command`.
4. Open `http://localhost:3001` if the browser does not open automatically.

To connect Gemini without editing hidden files, double-click `configure-gemini.command`, paste a Google AI Studio API key, and choose Save. The key stays in the local `.env` file and Study restarts automatically.

The main page shows the closest Assessment deadlines first, followed by this week’s progress for each selected course. Open a course to see its Canvas material list, mark items complete, generate an overview, or have a short conversation grounded in that week's Canvas pages.

Canvas and AI credentials stay in `.env` on your Mac. Do not share that file. AI features support Gemini, Qwen, or DeepSeek. For Gemini, use `AI_PROVIDER=gemini`, add the Google AI Studio key to `AI_API_KEY`, and choose a compatible model in `AI_MODEL`. Canvas materials and direct links remain available without AI.

Gemini uses an automatic two-model strategy: Study first asks `gemini-3.8-flash`. If the request times out after 20 seconds or Gemini returns a temporary 429/5xx error, Study retries and then falls back to `gemini-3.5-flash-lite`. Generated overviews show which model actually answered.

Course chat renders headings, bold text, numbered steps, bullets, code, and quotations instead of showing raw Markdown symbols. When a process or relationship benefits from a visual explanation, the tutor can return a compact concept map with a legend; simple answers stay text-only.

The manual weekly timetable lets a student add recurring classes with a course name, weekday, start and end time, and location. A compact schedule appears on the This Week page, while the dedicated Timetable view supports adding, editing, and deleting classes. Timetable data stays in browser local storage and is never sent to Canvas or GitHub.

Courses do not have to use exact `Week 1` module names. Study recognises Week, Module, Topic, Unit, Session, Chapter, numbered modules, and number words. If a subject only exposes Canvas Pages or Files, Study builds a simple course-material view automatically.

To close the app, double-click `stop-study.command`.

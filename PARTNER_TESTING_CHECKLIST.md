ShadowOps Pilot - Partner Testing Checklist
============================================

Before You Start
================

1. Ensure you have Docker Desktop installed and running
   - Windows: https://www.docker.com/products/docker-desktop
   - Mac: https://www.docker.com/products/docker-desktop
   - Linux: Docker Engine from your package manager
   
   To verify: Run "docker --version" in your terminal

2. Have your IQMS database credentials ready
   - Host/IP address
   - Port (usually 1521)
   - Username
   - Password
   - Database/SID name


Installation & Setup (5-10 minutes)
===================================

1. Extract the ZIP file
   unzip shadowops-pilot-1.0.0.zip
   cd shadowops-pilot-1.0.0

2. Run the setup script
   ./start.sh
   
   The script will:
   - Check Docker is running
   - Ask you 5 questions about your IQMS database
   - Save your settings
   - Start all services (database, API, web app)
   - Show you when it's ready

3. Wait for startup to complete (~30 seconds on first run)
   - You'll see status messages as services start
   - Final message will show the URL to access

4. Open your browser
   http://localhost:5173
   
   You should see the ShadowOps web interface


Testing Checklist
=================

Once you're logged in, try these things:

Dashboard
- [ ] Can you see the main dashboard?
- [ ] Are there any error messages?

Data
- [ ] Are IQMS work orders visible?
- [ ] Are plant statuses showing correctly?
- [ ] Can you see maintenance data?

Navigation
- [ ] Can you click between different pages?
- [ ] Do filters work?
- [ ] Can you export data?

Performance
- [ ] Does the interface feel responsive?
- [ ] Are pages loading quickly?
- [ ] Any browser console errors? (F12 to check)


Feedback Form
=============

Please record your observations:

1. What worked well?
   _____________________________________________
   _____________________________________________

2. What didn't work or was confusing?
   _____________________________________________
   _____________________________________________

3. What was slow or took too long?
   _____________________________________________
   _____________________________________________

4. What's missing or what would you add?
   _____________________________________________
   _____________________________________________

5. Overall rating (1-5 stars):
   [ ] 1 - Needs major work
   [ ] 2 - Major issues
   [ ] 3 - Works but needs improvement
   [ ] 4 - Good, minor issues
   [ ] 5 - Ready to go


Troubleshooting
===============

Docker won't start?
   - Make sure Docker Desktop is installed and running
   - On Windows: Check if virtualization is enabled in BIOS
   - On Mac: Check System Preferences > Security & Privacy

Can't connect to IQMS?
   - Verify host, port, username, password are correct
   - Run: ./start.sh again to reconfigure
   - Check your network can reach the IQMS server

Web app not loading?
   - Check Docker containers are running: docker-compose ps
   - Check logs: docker-compose logs -f
   - Wait another 30 seconds, browsers may cache

Need more help?
   - Check README.md in the package for full documentation
   - See DEMO_GUIDE.md for feature walkthrough


Stopping & Restarting
=====================

To stop everything:
   ./stop.sh

To start again:
   ./start.sh
   (It will remember your IQMS settings)

To clean up completely:
   docker-compose down -v


Contact & Support
=================

Please share your feedback by [DATE]:

Send to: [YOUR EMAIL]

Include:
- What you tested
- What worked well
- What needs improvement
- Any errors you encountered
- Your overall rating

Thank you for helping validate ShadowOps!

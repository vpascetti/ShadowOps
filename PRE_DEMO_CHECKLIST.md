# Pre-Demo Checklist

**Use this checklist before every pilot customer demo**

---

## ✅ Technical Setup (5 minutes before demo)

- [ ] **Database running**
  ```bash
  docker ps | grep shadowops-db
  # Should show: shadowops-db-1 running
  ```

- [ ] **Backend running**
  ```bash
  curl http://localhost:5050/api/health
  # Should return: {"ok":true}
  ```

- [ ] **Frontend running**
  ```bash
  curl -I http://localhost:5173
  # Should return: HTTP/1.1 200 OK
  ```

- [ ] **Sample data loaded**
  ```bash
  curl -s http://localhost:5050/api/demo/jobs | grep -o "job_id" | wc -l
  # Should return: 6 or more
  ```

- [ ] **Browser ready**
  - Open http://localhost:5173
  - Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)
  - Close unnecessary tabs
  - Full screen the demo (F11 or Cmd+Shift+F)

---

## ✅ Demo Prep

- [ ] **Review DEMO_GUIDE.md** (5 min skim)
- [ ] **Have SAMPLE_JOBS.csv ready** for upload demo
- [ ] **Test CSV upload flow** once before demo
- [ ] **Know your audience**
  - Plant Manager? → Focus on Executive Briefing
  - Production Supervisor? → Focus on Operational Dashboard
  - CFO/COO? → Focus on ROI and metrics

---

## ✅ Environment Check

- [ ] **Good internet connection** (for video calls)
- [ ] **Screen share tested** (if virtual demo)
- [ ] **Backup plan** (screen recording ready if tech fails)
- [ ] **Water nearby** (you'll be talking for 15-20 min)

---

## ✅ Materials Ready

- [ ] **DEMO_GUIDE.md** open in second monitor/tab
- [ ] **PILOT_PITCH.md** for pricing questions
- [ ] **Pilot agreement** (draft ready to send)
- [ ] **Calendar link** for follow-up meetings

---

## ✅ Mental Prep

- [ ] **Know your opening**: "ShadowOps is a real-time intelligence layer..."
- [ ] **Know your close**: "We have 2 pilot slots left..."
- [ ] **Remember**: You're solving their $500K/year problem
- [ ] **Confidence**: This product is ready and impressive

---

## 🚀 Start Sequence (If Services Not Running)

```bash
# One command to start everything:
./start.sh

# Wait 5 seconds, then verify:
curl http://localhost:5050/api/health
curl -I http://localhost:5173

# Open browser:
open http://localhost:5173  # Mac
# or
xdg-open http://localhost:5173  # Linux
```

---

## 🛑 Emergency Troubleshooting

### Frontend won't load
```bash
pkill -f vite
cd /workspaces/ShadowOps
npm run dev
```

### Backend won't respond
```bash
pkill -f "node index.js"
cd /workspaces/ShadowOps/server
npm start
```

### Database issues
```bash
docker-compose restart
sleep 3
```

### Nuclear option (reset everything)
```bash
./stop.sh
docker-compose down -v  # WARNING: Deletes all data
./start.sh
# Re-upload SAMPLE_JOBS.csv through UI
```

---

## 📋 Post-Demo Checklist

- [ ] **Send follow-up email** within 24 hours
- [ ] **Share demo recording** (if recorded)
- [ ] **Send pilot agreement** (if interested)
- [ ] **Schedule technical deep-dive** (if needed)
- [ ] **Add to CRM** with next action date
- [ ] **Update pilot slots remaining** (if signed)

---

## 🎯 Success Criteria

**Good demo if prospect:**
- ✅ Asks detailed questions about their specific use case
- ✅ Mentions specific problems they're currently facing
- ✅ Wants to show their team
- ✅ Asks about pricing/timeline without prompting

**Great demo if prospect:**
- ✅ Says "this would solve X problem we have"
- ✅ Asks "how soon can we start?"
- ✅ Introduces you to decision-makers on the call
- ✅ Verbally commits to pilot

**Demo to close:**
- ✅ Says "send me the agreement"
- ✅ Pulls out calendar to schedule kickoff
- ✅ Discusses payment/procurement process
- ✅ Starts planning internal rollout

---

**You got this! Go close those pilots! 🚀**

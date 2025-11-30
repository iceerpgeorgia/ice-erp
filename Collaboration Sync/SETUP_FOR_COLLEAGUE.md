# Collaborative Development Setup Guide

## 🎯 Quick Start - Setup Instructions

### Prerequisites
- VS Code installed
- Git installed
- Access to GitHub repository: `iceerpgeorgia/ice-erp`

---

## 📥 Step 1: Clone the Repository

```powershell
# Clone the project to your local machine
git clone https://github.com/iceerpgeorgia/ice-erp.git
cd ice-erp

# Install dependencies
npm install
```

---

## 🔄 Step 2: Set Up Automatic Sync

We have a script that automatically syncs changes between both developers every 5 minutes.

### Open a NEW PowerShell Terminal and Run:

```powershell
.\scripts\continuous-sync.ps1
```

**This will:**
- ✅ Auto-commit your changes every 5 minutes
- ✅ Auto-pull teammate's changes every 5 minutes
- ✅ Auto-push to GitHub
- ✅ Keep both developers in sync automatically

**Keep this terminal running in the background while you work.**

---

## 💻 Step 3: Install VS Code Live Share (Optional but Recommended)

For real-time pair programming:

1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions)
3. Search for "Live Share"
4. Install `MS-vsliveshare.vsliveshare`

**How to use:**
- Click "Live Share" button in bottom status bar
- Share the link with your teammate
- Both can edit files simultaneously in real-time

---

## 🛠️ Daily Workflow

### Starting Your Work Session:

```powershell
# 1. Pull latest changes
git pull origin main

# 2. Start continuous sync (in separate terminal)
.\scripts\continuous-sync.ps1

# 3. Start working!
```

### During Work:

- Just code normally - auto-sync handles everything
- Changes sync every 5 minutes automatically
- Check the sync terminal to see updates

### Manual Sync (if needed):

```powershell
# Pull teammate's changes
git pull origin main

# Push your changes
git add .
git commit -m "describe your changes"
git push origin main
```

---

## 🚀 Environment Setup

### Create `.env.local` file:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=your-database-url
REMOTE_DATABASE_URL=your-remote-database-url
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
```

### Run the App:

```powershell
# Development server
npm run dev

# Open browser
http://localhost:3000
```

---

## 📋 Available Commands

```powershell
# Development
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run start                  # Start production server

# Database
npm run prisma:studio          # Open Prisma Studio
npm run prisma:migrate         # Run migrations
npm run prisma:generate        # Generate Prisma Client

# Data Import
npm run import:countries       # Import countries
npm run import:entity-types    # Import entity types
```

---

## 🔧 Troubleshooting

### Merge Conflicts:

If you see merge conflicts:

1. Open the conflicted file
2. Look for conflict markers:
   ```
   <<<<<<< HEAD
   Your changes
   =======
   Teammate's changes
   >>>>>>> origin/main
   ```
3. Choose which changes to keep
4. Remove the markers
5. Save and commit:
   ```powershell
   git add .
   git commit -m "resolved merge conflict"
   git push origin main
   ```

### Sync Script Issues:

If continuous sync stops:
```powershell
# Stop it (Ctrl+C) and restart
.\scripts\continuous-sync.ps1
```

### Out of Sync:

If you're behind:
```powershell
git fetch origin
git reset --hard origin/main  # ⚠️ This discards local changes!
```

---

## 🤝 Communication Best Practices

1. **Before starting work**: Pull latest changes
2. **Before big changes**: Let teammate know via chat
3. **Use Live Share**: For real-time collaboration on same feature
4. **Regular commits**: Commit often with clear messages
5. **End of day**: Ensure all changes are pushed

---

## 📞 Need Help?

- Check the sync terminal for status
- Use `git status` to see current state
- Ask teammate via chat/call if confused
- Review `COLLABORATION_GUIDE.md` for detailed workflows

---

## ⚠️ Important Notes

- ✅ Keep continuous-sync running while working
- ✅ Don't commit `.env.local` (it's in .gitignore)
- ✅ Communicate before major changes
- ✅ Pull before starting work each day
- ❌ Don't force push (`git push --force`)
- ❌ Don't work directly in `node_modules`

---

## 🎉 You're Ready!

Start the sync script and begin coding. Changes will automatically sync every 5 minutes!

**Questions?** Ask your teammate or check the collaboration guide.

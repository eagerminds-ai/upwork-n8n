# Upwork AI Job Fetcher with Slack Approval System

An automated n8n workflow that fetches AWS/DevOps jobs from Upwork, generates AI-powered proposals using GPT-5, saves to Notion database, and sends Slack notifications for approval.

## 🚀 Features

- **Automated Job Fetching**: Hourly searches for AWS jobs on Upwork
- **Duplicate Detection**: Prevents processing the same job twice
- **AI Proposal Generation**: GPT-5 powered personalized proposals
- **Notion Integration**: Saves all jobs and proposals to database
- **Slack Approval System**: Interactive buttons for approve/reject
- **Smart Filtering**: Only processes new jobs not in database

## 📋 Prerequisites

- n8n instance (self-hosted or cloud)
- **Upwork API access** (requires approval - see setup guide)
- **OpenAI API key** with GPT-5 access
- **Notion workspace** with integration permissions
- **Slack workspace** with admin access for bot creation

## 🔧 Setup Guide

### 1. Upwork OAuth2 Credentials

1. **Get API Keys**:
   - Go to [Upwork Developer Keys](https://www.upwork.com/developer/keys/)
   - Sign in with your Upwork account
   - You'll see your existing API keys or can create new ones
   - Note down your **Client ID** and **Client Secret**

2. **Configure Redirect URI**:
   - Click **Edit** on your API key
   - Update the **Redirect URI** to match your n8n instance:
     - For cloud n8n: `https://your-domain.n8n.cloud/rest/oauth2-credential/callback`
     - For self-hosted: `https://your-domain.com/rest/oauth2-credential/callback`
     - For local development: `http://localhost:5678/rest/oauth2-credential/callback`
   - **Example**: `https://n8n.eagerminds.in/rest/oauth2-credential/callback`
   - Save the changes

3. **Important Notes**:
   - ⚠️ The redirect URI must match EXACTLY what n8n uses
   - ⚠️ Include the full path `/rest/oauth2-credential/callback`
   - ⚠️ Use HTTPS for production (HTTP only for localhost)

4. **Configure in n8n**:
   - Go to **Credentials** → **Create New** → **OAuth2 API**
   - Name: "Upwork"
   - Grant Type: "Authorization Code"
   - Authorization URL: `https://www.upwork.com/api/auth/v1/oauth/authorize`
   - Access Token URL: `https://www.upwork.com/api/auth/v1/oauth/token`
   - Client ID: [Your Client ID from Upwork]
   - Client Secret: [Your Client Secret from Upwork]
   - Scope: `read` (minimum required scope)
   - Auth URI Query Parameters: Leave empty
   - Authentication: "Send as Basic Auth Header"

5. **Important API Limitations**:
   - **Rate Limits**: 100 requests per hour per application
   - **Scope Restrictions**: Limited to reading public job postings
   - **Approval Required**: Each API key must be approved by Upwork
   - **Terms Compliance**: Must comply with Upwork API Terms of Service

### 2. Notion Integration Setup

1. **Create Notion Integration**:
   - Go to [Notion Developers](https://developers.notion.com/)
   - Click "Create new integration"
   - Name: "n8n Upwork Integration"
   - Select workspace and create

2. **Get Integration Token**:
   - Copy the **Internal Integration Token** (starts with `secret_`)

3. **Create Database**:
   - Create a new page in Notion
   - Add a database with these **exact field names**:

   | Field Name | Type | Description |
   |------------|------|-------------|
   | **Job Title** | Title | Primary field (required) |
   | **Job ID** | Rich Text | Upwork job ID with 02 prefix |
   | **Description** | Rich Text | Job description |
   | **Skills** | Rich Text | Required skills |
   | **Job URL** | URL | Direct link to Upwork job |
   | **Category** | Rich Text | Job category |
   | **Proposal** | Rich Text | AI-generated proposal |
   | **Status** | Select | New, In Progress, Applied |
   | **Application Status** | Select | To Apply, Applied, Rejected |
   | **Approval Status** | Select | Pending, Approved, Rejected |
   | **Priority** | Select | Low, Medium, High |
   | **Budget** | Number | Job budget amount |
   | **Client Rating** | Number | Client rating (0-5) |
   | **Match Score** | Number | Calculated match score |

4. **Share Database with Integration**:
   - Click **Share** on your database
   - Add your integration and give it **Edit** permissions
   - Copy the **Database ID** from URL: `https://notion.so/[DATABASE_ID]?v=...`

### 3. OpenAI API Setup

1. **Get API Key**:
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create new API key with GPT-5 access
   - Copy the key (starts with `sk-`)

2. **Configure in n8n**:
   - Go to **Credentials** → **Create New** → **HTTP Bearer Auth**
   - Name: "Bearer Auth account"
   - Token: [Your OpenAI API Key]

### 4. Slack App Setup

1. **Create Slack App**:
   - Go to [Slack API](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - App Name: "Upwork Job Approver"
   - Select your workspace

2. **Configure OAuth & Permissions**:
   - Go to **OAuth & Permissions**
   - Add these scopes under **Bot Token Scopes**:
     - `chat:write` - Send messages
     - `chat:write.public` - Send messages to channels
   - Install app to workspace
   - Copy **Bot User OAuth Token** (starts with `xoxb-`)

3. **Create Channel**:
   - Create a dedicated channel: `#upwork-jobs`
   - Invite your bot to the channel
   - Get Channel ID from channel URL or right-click → View channel details


## 🎯 Customization Guide

### How to Change Job Search Terms

1. **Open the workflow** in n8n
2. **Find the "Search AI Jobs (Fixed Query)" node**
3. **Edit the search term** in the JSON body:

```json
{
  "variables": {
    "marketPlaceJobFilter": {
      "searchTerm_eq": {
        "andTerms_all": "AWS"  // Change this to your desired search term
      },
      "pagination_eq": {
        "first": 10,  // Number of jobs to fetch (max 100)
        "after": "0"
      }
    }
  }
}
```

**Common Search Terms**:
- `"AWS"` - Amazon Web Services jobs
- `"DevOps"` - DevOps positions
- `"Terraform"` - Infrastructure as Code
- `"Docker Kubernetes"` - Container technologies
- `"Python"` - Python development
- `"React"` - Frontend development

**Note**: Advanced filters (budget, location, experience level) are not reliably supported by Upwork's public API and may not work as expected.

### How to Change AI System Prompt (More/Less Formal)

**Method 1: Edit Template File**
1. **Edit the template**: `nano aws-expert.md`
2. **Modify the content** to be more/less formal:

```markdown
---
template_id: "formal_expert"
---

Good day,

I am a seasoned AWS Solutions Architect with extensive experience...
```

3. **Update the workflow**: `./update-template.sh aws-expert.md`

**Method 2: Direct Edit in Workflow**
1. **Open "Generate AI Proposal (HTTP)" node**
2. **Find the system message content**
3. **Replace with your preferred tone**:

```javascript
// For MORE FORMAL proposals:
content: `Dear Hiring Manager,

I am writing to express my interest in your AWS infrastructure project.

With over 10 years of experience in cloud architecture and DevOps practices, I have successfully delivered enterprise-scale solutions...

Best regards,
Mehul Prajapati
AWS Certified Solutions Architect`

// For LESS FORMAL proposals:
content: `Hey there! 👋

Saw your AWS gig and it looks right up my alley!

I've been crushing it with AWS for 10+ years - ECS migrations, Lambda cost-cuts, the whole nine yards. Just wrapped up a project where we cut costs by 40% while boosting performance.

Ready to dive in whenever you are!

Cheers,
Mehul`
```

### How to Set Up Cron Frequency

1. **Open the "Hourly Job Fetch" node** (cron trigger)
2. **Modify the trigger schedule**:

```json
// EVERY HOUR (current setting)
"triggerTimes": {
  "item": [{ "hour": 11 }]  // Only runs at 11 AM
}

// MULTIPLE TIMES PER DAY
"triggerTimes": {
  "item": [
    { "hour": 9 },   // 9 AM
    { "hour": 14 },  // 2 PM
    { "hour": 18 }   // 6 PM
  ]
}

// EVERY 30 MINUTES (requires different trigger type)
// Change to "Schedule Trigger" node with:
"rule": {
  "interval": [{ "field": "cronExpression", "expression": "*/30 * * * *" }]
}

// WEEKDAYS ONLY
"rule": {
  "interval": [{
    "field": "cronExpression",
    "expression": "0 11 * * 1-5"  // 11 AM, Monday-Friday
  }]
}
```


---

**⚡ Quick Start Checklist**

- [ ] Get Upwork OAuth2 credentials
- [ ] Create Notion integration and database
- [ ] Set up Slack app with bot token
- [ ] Get OpenAI API key with GPT-5 access
- [ ] Import workflow to n8n
- [ ] Update all credentials in nodes
- [ ] Test workflow execution
- [ ] Set up monitoring and alerts

**Need help?** Contact us at admin@eagerminds.in
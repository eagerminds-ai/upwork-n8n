# Slack Interactive Approval System with n8n

A complete guide to create a Slack app that sends approval/rejection buttons and integrates with n8n workflows for automated decision handling.

## Overview

This system creates a two-workflow setup:
1. **Main Workflow**: Sends approval requests to Slack with interactive buttons
2. **Handler Workflow**: Processes button clicks and updates your database/system

## Prerequisites

- n8n instance running and accessible
- Slack workspace admin access
- Database/system to update (e.g., Notion, Airtable, etc.)

## Step 1: Create Slack App

### 1.1 Create New App
1. Go to [Slack API Dashboard](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. App Name: `[YOUR_APP_NAME]` (e.g., "Job Approval Bot")
4. Workspace: Select your workspace
5. Click "Create App"

### 1.2 Configure OAuth & Permissions
1. Go to "OAuth & Permissions" in left sidebar
2. Add these **Bot Token Scopes**:
   ```
   chat:write
   chat:write.public
   channels:read
   groups:read
   im:read
   mpim:read
   ```
3. **Redirect URLs**: Add your n8n instance URL (optional for this setup)
4. Click "Install to Workspace" 
5. Copy the **Bot User OAuth Token** (starts with `xoxb-`) - you'll need this

### 1.3 Enable Interactivity
1. Go to "Interactivity & Shortcuts" in left sidebar
2. Turn on "Interactivity"
3. **Request URL**: `https://[YOUR_N8N_DOMAIN]/webhook/slack-approval`
   - Replace `[YOUR_N8N_DOMAIN]` with your n8n instance domain
   - The `/slack-approval` path will be created in Step 2

## Step 2: Create n8n Handler Workflow

### 2.1 Create New Workflow
1. In n8n, create new workflow
2. Name: "Slack Approval Handler"

### 2.2 Add Webhook Node
1. Add **Webhook** node
2. Configure:
   - **HTTP Method**: POST
   - **Path**: `slack-approval`
   - **Response Mode**: "Response Node"
   - **Options** → **Raw Body**: ✅ Enable

### 2.3 Add Parse Payload Function Node
Add **Function** node with this code:
```javascript
// Slack sends payload as URL-encoded form data
console.log('Raw webhook data:', JSON.stringify($json, null, 2));

let payload;

// Handle different possible formats
if ($json.payload) {
  payload = typeof $json.payload === 'string' ? JSON.parse($json.payload) : $json.payload;
} else if ($json.body) {
  if (typeof $json.body === 'string') {
    const urlParams = new URLSearchParams($json.body);
    const payloadString = urlParams.get('payload');
    
    if (payloadString) {
      payload = JSON.parse(payloadString);
    } else {
      throw new Error('No payload parameter found in URL-encoded body');
    }
  } else if ($json.body.payload) {
    payload = typeof $json.body.payload === 'string' ? JSON.parse($json.body.payload) : $json.body.payload;
  } else {
    payload = $json.body;
  }
} else {
  throw new Error('No payload found');
}

// Extract relevant data
const action = payload.actions[0];
const [actionType, recordId] = action.value.split(':');

const result = {
  actionType: actionType,
  recordId: recordId,
  actionId: action.action_id,
  userId: payload.user.id,
  userName: payload.user.username || payload.user.name,
  teamId: payload.team.id,
  channelId: payload.channel.id,
  messageTs: payload.message.ts,
  responseUrl: payload.response_url,
  triggerTime: new Date().toISOString()
};

console.log(`🔔 Received ${actionType} action for record: ${recordId}`);
console.log(`👤 User: ${result.userName} (${result.userId})`);

return [{json: result}];
```

### 2.4 Add Database Update Node
Add **HTTP Request** node to update your database:
```
Method: PATCH (or POST depending on your API)
URL: =https://[YOUR_DATABASE_API]/[ENDPOINT]/{{$json.recordId}}
Headers:
  - Authorization: Bearer [YOUR_API_TOKEN]
  - Content-Type: application/json
Body (JSON):
{
  "status": "={{ $json.actionType === 'approve' ? 'Approved' : 'Rejected' }}",
  "approved_by": "={{$json.userName}}",
  "updated_at": "={{new Date().toISOString()}}"
}
```

### 2.5 Add Get Record Details Node (Optional)
If you need full record details for the Slack response:
```
Method: GET
URL: =https://[YOUR_DATABASE_API]/[ENDPOINT]/{{ $('Parse Slack Payload').first().json.recordId }}
Headers:
  - Authorization: Bearer [YOUR_API_TOKEN]
```

### 2.6 Add Combine Data Function Node
```javascript
const originalData = $('Parse Slack Payload').first().json;
const recordData = $json;

// Extract relevant fields from your record
let recordTitle = 'Unknown Record';
let recordUrl = null;

if (recordData && recordData.properties) {
  // Adjust these based on your database structure
  recordTitle = recordData.properties['Title']?.title?.[0]?.text?.content || 'Unknown Record';
  recordUrl = recordData.properties['URL']?.url;
}

const combinedData = {
  ...originalData,
  recordTitle: recordTitle,
  recordUrl: recordUrl,
  recordData: recordData
};

return [{json: combinedData}];
```

### 2.7 Add Update Slack Message Node
**HTTP Request** node:
```
Method: POST
URL: ={{$json.responseUrl}}
Headers:
  - Content-Type: application/json
Body (JSON):
{
  "replace_original": true,
  "text": "={{ $json.actionType === 'approve' ? '✅ Approved by ' + $json.userName : '❌ Rejected by ' + $json.userName }}",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "={{ $json.actionType === 'approve' ? '✅ *' + $json.recordTitle + ' approved by ' + $json.userName + '*\\n\\nThe record has been marked as approved.' : '❌ *' + $json.recordTitle + ' rejected by ' + $json.userName + '*\\n\\nThe record has been marked as rejected.' }}"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "={{ $json.recordUrl ? '<' + $json.recordUrl + '|View Record>' : 'Record URL not available' }}"
      }
    },
    {
      "type": "context",
      "elements": [{
        "type": "mrkdwn",
        "text": "Updated at {{ new Date().toLocaleString() }}"
      }]
    }
  ]
}
```

### 2.8 Add Response Node
**Respond to Webhook** node:
```
Respond With: JSON
Response Body: {"ok": true}
```

### 2.9 Connect the Nodes
Connect in this order:
1. Webhook → Parse Slack Payload
2. Parse Slack Payload → Update Database
3. Update Database → Get Record Details (if using)
4. Get Record Details → Combine Data (if using)
5. Combine Data → Update Slack Message
6. Update Slack Message → Respond to Webhook

### 2.10 Activate Workflow
Click "Active" to enable the workflow.

## Step 3: Create Main Workflow (Sender)

### 3.1 Create Workflow Structure
Your main workflow should:
1. Fetch records that need approval
2. Format Slack messages with buttons
3. Send to Slack

### 3.2 Add Format Slack Message Node
**Function** node to create button messages:
```javascript
// Process all records that need approval
const records = $input.all();
console.log(`📨 Formatting Slack messages for ${records.length} records...`);

const formattedMessages = [];

for (let i = 0; i < records.length; i++) {
  const record = records[i].json;
  
  const slackMessage = {
    channel: "#[YOUR_CHANNEL]", // e.g., "#approvals"
    text: `New record needs approval: ${record.title || 'Untitled'}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${record.title || 'New Record'}*\n\n${record.description || 'No description available'}`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Created:*\n${new Date(record.created_date || Date.now()).toLocaleDateString()}`
          },
          {
            type: "mrkdwn",
            text: `*Priority:*\n${record.priority || 'Normal'}`
          }
        ]
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ Approve"
            },
            style: "primary",
            action_id: "approve_action",
            value: `approve:${record.id}`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "❌ Reject"
            },
            style: "danger",
            action_id: "reject_action",
            value: `reject:${record.id}`
          }
        ]
      }
    ]
  };
  
  formattedMessages.push({
    json: {
      ...record,
      slackMessage: slackMessage
    }
  });
}

return formattedMessages;
```

### 3.3 Add Slack Send Message Node
**Slack** node:
```
Authentication: Create new credential
  - Access Token: [YOUR_BOT_TOKEN] (from Step 1.2)
Resource: Message
Operation: Post
Channel: ={{$json.slackMessage.channel}}
Text: ={{$json.slackMessage.text}}
Blocks (JSON): ={{JSON.stringify($json.slackMessage.blocks)}}
```

## Step 4: Update Slack App Configuration

### 4.1 Update Request URL
1. Go back to Slack API Dashboard → Your App
2. "Interactivity & Shortcuts"
3. Update **Request URL** to your activated n8n webhook:
   `https://[YOUR_N8N_DOMAIN]/webhook-test/[WEBHOOK_ID]`
   - Get the webhook ID from your activated n8n workflow

## Step 5: Testing

### 5.1 Test the Handler Workflow
1. In n8n, go to your handler workflow
2. Check the webhook URL
3. Use this URL in Slack app settings

### 5.2 Test End-to-End
1. Run your main workflow
2. Check Slack channel for approval messages
3. Click Approve/Reject buttons
4. Verify database updates
5. Check Slack message updates

## Configuration Placeholders

Replace these placeholders with your actual values:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `[YOUR_APP_NAME]` | Your Slack app name | "Job Approval Bot" |
| `[YOUR_N8N_DOMAIN]` | Your n8n instance domain | "n8n.example.com" |
| `[YOUR_DATABASE_API]` | Your database API endpoint | "api.notion.com/v1" |
| `[YOUR_API_TOKEN]` | Your database API token | "ntn_abc123..." |
| `[YOUR_BOT_TOKEN]` | Slack bot token from OAuth | "xoxb-123-456..." |
| `[YOUR_CHANNEL]` | Slack channel for approvals | "#approvals" |
| `[ENDPOINT]` | Database endpoint path | "pages" |

## Troubleshooting

### Common Issues

1. **404 Error on Button Click**
   - Ensure handler workflow is activated
   - Check webhook URL in Slack app settings

2. **"No payload found" Error**
   - Verify webhook has "Raw Body" enabled
   - Check Parse Payload function code

3. **Database Update Fails**
   - Verify API token and permissions
   - Check database API documentation

4. **Slack Message Not Updating**
   - Ensure `response_url` is captured correctly
   - Check Update Slack Message node configuration

### Debugging Tips

1. Use n8n's execution view to see data flow
2. Add console.log statements in Function nodes
3. Check Slack API logs in your app dashboard
4. Test webhook endpoint manually with tools like Postman

## Security Notes

- Store all tokens as n8n credentials, not in workflow code
- Use HTTPS for all webhook URLs
- Implement proper error handling
- Consider rate limiting for production use

## Support

For issues with:
- **Slack API**: Check [Slack API Documentation](https://api.slack.com/)
- **n8n**: Check [n8n Documentation](https://docs.n8n.io/)
- **This Setup**: Review the workflow execution logs in n8n

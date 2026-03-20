# 🥕 JOM26 Veg Pledge - Public Widget

## What This Is

A production-ready widget for displaying and collecting veg pledges. The widget consists of two independent but communicating components:

1. **Form Widget** (`form.html`) - Multi-step pledge form for users
2. **Patch Widget** (`patch.html`) - Growing vegetable patch visualisation

## ✅ Key Features

- ✅ **No Dependencies** - Pure HTML/CSS/JavaScript, no frameworks required
- ✅ **PostMessage Communication** - Widgets communicate automatically when pledges are submitted
- ✅ **Standalone or Embedded** - Can be used as standalone pages or embedded via iframes
- ✅ **Real-time Sync** - Multiple patch widgets on the same page sync together
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile

## 📁 Files

```
public_widget/
├── index.html              ← Integration example (embed both widgets)
├── form.html             ← Pledge form widget
├── patch.html            ← Veg patch visualisation
├── form-widget-app.js    ← Form widget logic (PostMessage)
├── patch-widget-app.js   ← Patch widget logic (PostMessage)
├── veg-patch-standalone.js  ← Vegetable patch renderer (Canvas)
└── README.md             ← This file
```

## 🚀 Quick Start

### Option 1: Embed in Your Website (Recommended)

Add these iframes to your webpage:

```html
<!-- Veg Patch Widget -->
<iframe src="https://your-domain.com/public_widget/patch.html" 
  width="100%" 
  height="650" 
  frameborder="0"
  title="JOM26 Veg Patch Progress"
  scrolling="no">
</iframe>

<!-- Form Widget -->
<iframe src="https://your-domain.com/public_widget/form.html" 
  width="100%" 
  height="600" 
  frameborder="0"
  title="JOM26 Veg Pledge Form"
  scrolling="no">
</iframe>
```

### Option 2: Use as Standalone Pages

Simply open `index.html` in a browser - it shows both widgets working together.

## 🔗 How Widgets Communicate

The widgets use the `postMessage` API to communicate:

1. **Form submits pledge** → Calculates tokens (1 per person, more for families/schools/etc.)
2. **Form broadcasts update** → Sends `PLEDGE_SUBMITTED` message via `window.postMessage()`
3. **Patch receives message** → Adds tokens to total and updates display
4. **Patch broadcasts sync** → If you have multiple patches, they all sync together

### Message Types

**Form sends:**
```javascript
{
  type: 'PLEDGE_SUBMITTED',
  tokens: 1,  // or more based on user type
  data: { name, email, pledge, user_type, ... }
}
```

**Patch sends:**
```javascript
{
  type: 'PATCH_UPDATE',
  total: 1247,
  goal: 100000,
  submissions: 5
}
```

**External control:**
```javascript
// Update from admin or other sources
{
  type: 'UPDATE_TOTAL',
  total: 5000,
  goal: 100000
}
```

## 🎨 Token Calculation

Tokens are awarded based on pledge type:

| User Type | Tokens | Example |
|-----------|--------|---------|
| Individual | 1 | 1 person pledges |
| Family | Family count | 4 members = 4 tokens |
| School | Class size | 30 students = 30 tokens |
| Organisation | Up to 100 | 50 participants = 50 tokens |
| Community | Group size | 15 members = 15 tokens |

## 📱 Responsive Design

Both widgets are fully responsive:

- **Desktop**: Full width layout with all features
- **Tablet**: Stacked layout, larger touch targets
- **Mobile**: Optimized for single-column scrolling

## 🌐 Browser Support

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers

## 📊 Demo State

The patch starts with:
- **Total**: 1,247 seeds
- **Goal**: 100,000 seeds
- **Progress**: ~1.2%

You can adjust the starting values in `patch-widget-app.js` lines 6-10.

## 🛠️ Customization

### Change Starting Values

Edit `patch-widget-app.js`:
```javascript
let patchState = {
  total: 1247,  // Change this
  goal: 100000,  // Change this
  submissions: 0
};
```

### Modify Token Calculation

Edit `form-widget-app.js` lines 216-226:
```javascript
let tokens = 1;
if (widgetState.userType === 'family') {
  tokens = submissionData.participants_count || 1;
}
// Add your own logic here
```

## 📋 Requirements

### For Just the Widget (This Package)
- None! Pure HTML/CSS/JS

### For Admin Console (Separate)
See `../demo-local/admin/` for admin controls:
- Goal management
- Token adjustments
- Submission viewing

## 🔐 Security Notes

**This widget does NOT:**
- Store personal data (formdata is broadcast but not saved)
- Handle authentication
- Prevent duplicate submissions
- Validate email domains

**For production use**, consider:
1. Adding backend validation
2. Implementing rate limiting
3. Adding CAPTCHA to prevent abuse
4. Setting up proper data storage (Firebase/Database)

## 📞 Integration Guide

### Step 1: Upload Files
Upload all files from `public_widget/` to your web server.

### Step 2: Add Iframes
Embed the widgets in your target page:

```html
<div style="text-align: center;">
  <h2>🌱 Join Our Veg Pledge Campaign!</h2>
  
  <!-- Patch -->
  <iframe src="public_widget/patch.html" 
    width="100%" height="650" frameborder="0"></iframe>
  
  <!-- Form -->
  <iframe src="public_widget/form.html" 
    width="100%" height="600" frameborder="0"></iframe>
</div>
```

### Step 3: Test
1. Open the page in a browser
2. Submit a pledge in the form widget
3. Watch the veg patch update automatically
4. Try embedding multiple patches - they all sync!

## 🎯 Campaign Goals

Set your campaign goal by updating `patch-widget-app.js`:

```javascript
let patchState = {
  total: 0,        // Starting total
  goal: 100000,    // Set your campaign goal
  submissions: 0
};
```

## 📊 Analytics

To track submissions, you can:

1. **Use the form data** - The `PLEDGE_SUBMITTED` message contains all submission data
2. **Set up Google Analytics** - Trigger events on form submit
3. **Connect to CRM** - Use form data to push to your system

Example tracking:
```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'PLEDGE_SUBMITTED') {
    console.log('New pledge:', event.data);
    // Send to your analytics service
    ga('send', 'event', 'Pledge', 'Submitted', event.data.tokens);
  }
});
```

## 🌟 Tips

1. **Position the form first** - Users see the form, then see their impact in the patch
2. **Use vibrant colors** - The veg patch shows progress vividly
3. **Update the goal** - Adjust goal based on campaign milestones
4. **Show real campaigns** - Embed the patch on multiple pages to aggregate data

## 📝 License

Free to use and modify for your campaigns.

## 🐛 Troubleshooting

**Widgets not syncing:**
- Check browser console for errors
- Ensure same-origin policy isn't blocking postMessage
- Test by opening both pages in separate tabs

**Patch not rendering:**
- Check canvas is visible (not hidden by CSS)
- Verify JavaScript is enabled
- Ensure all JS files are loaded

**Form won't submit:**
- Check required fields are filled
- Validate user type is selected
- Check browser console for errors

## 📞 Questions?

For issues or features, check the demo-local documentation or contact support.

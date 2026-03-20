# 🚀 Widget-New Quick Start

## Testing Admin Console Communication

### Option 1: Integrated Test Page (Recommended)
**File:** `admin-test.html`

This shows the admin console and widget-new patch side-by-side:

1. Open `widget-new/admin-test.html` in your browser
2. You'll see:
   - **Left:** Admin console with demo controls
   - **Right:** Widget-new veg patch
3. Click "+1,000 Seeds" in the admin console
4. Watch the veg patch on the right update instantly!

### Option 2: Main Integration Example
**File:** `index.html`

This shows both widgets with demo controls:

1. Open `widget-new/index.html` in your browser
2. Click demo control buttons at the top
3. Watch the veg patch update
4. Fill out the form and submit
5. Watch the veg patch update again!

## Demo Control Buttons

All buttons now work and update the veg patch:

- **+100 Seeds** - Small update to test
- **+1,000 Seeds** - Medium update, see vegetables start growing
- **+10,000 Seeds** - Large update, see full vegetable garden!
- **Change Goal** - Update the target (affects percentage)
- **Reset to 0** - Start over from empty patch

## How Communication Works

```
Admin Console
    │
    ├─> Click "+1,000 Seeds"
    │
    └─> Sends postMessage:
        {
          type: 'UPDATE_TOTAL',
          total: 2247,
          goal: 100000
        }
        
Veg Patch Widget
    │
    ├─> Receives postMessage
    │
    ├─> Updates internal state
    │
    └─> Renders new vegetables!
```

## Files Overview

```
widget-new/
├── index.html              ← Main demo (form + patch + controls)
├── admin-test.html         ← Admin + Patch side-by-side test
├── form.html               ← Standalone form widget
├── patch.html              ← Standalone veg patch widget
├── form-widget-app.js      ← Form logic
├── patch-widget-app.js     ← Patch logic + postMessage
└── veg-patch-standalone.js ← Canvas renderer
```

## Embedding in Your Site

### Veg Patch Only
```html
<iframe 
  src="patch.html" 
  width="100%" 
  height="650"
  frameborder="0">
</iframe>
```

### Form Only
```html
<iframe 
  src="form.html" 
  width="100%" 
  height="600"
  frameborder="0">
</iframe>
```

### Controlling from JavaScript

If you have the patch in an iframe, you can control it:

```javascript
const patchIframe = document.getElementById('patch-iframe');

// Add tokens
patchIframe.contentWindow.postMessage({
  type: 'UPDATE_TOTAL',
  total: 5000
}, '*');

// Update goal
patchIframe.contentWindow.postMessage({
  type: 'UPDATE_TOTAL',
  total: 5000,
  goal: 200000
}, '*');
```

## Troubleshooting

**Patch not updating?**
- Open browser console (F12)
- Check for postMessage logs
- Verify iframe IDs match
- Check for JavaScript errors

**Still not working?**
- Try refreshing the page
- Clear browser cache
- Make sure you're not blocking JavaScript
- Test in a different browser

## Next Steps

1. ✅ Test the demo controls work
2. ✅ Submit a test pledge via the form
3. ✅ Verify the patch updates
4. 📝 Customize pledge dropdown options
5. 🎨 Replace graphics (see CUSTOMIZATION_GUIDE.md)
6. 🚀 Deploy to your website
7. 🔗 Embed using iframe codes

## Production Integration

In production with Firebase backend:

1. Admin console updates Firebase Firestore
2. Veg patch polls Firebase for updates every 30 seconds
3. All patches across your site stay synchronized
4. Form submissions trigger Cloud Functions
5. Everything updates in real-time

The demo shows this working without the backend!

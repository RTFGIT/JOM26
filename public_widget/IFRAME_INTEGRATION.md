# 🎯 iframe Integration Guide

## Quick Start - Embed Both Widgets

### Option 1: Both Widgets on Same Page

```html
<!-- Veg Patch Progress Widget -->
<iframe 
  src="https://your-domain.com/patch.html" 
  width="100%" 
  height="650" 
  frameborder="0"
  title="JOM26 Veg Patch Progress">
</iframe>

<!-- Pledge Form Widget -->
<iframe 
  src="https://your-domain.com/form.html" 
  width="100%" 
  height="600" 
  frameborder="0"
  title="JOM26 Veg Pledge Form">
</iframe>
```

### Option 2: Veg Patch Only (Multiple Locations)

You can embed the veg patch widget on multiple pages:

**Homepage:**
```html
<iframe src="https://your-domain.com/patch.html" 
  width="100%" height="650" frameborder="0"></iframe>
```

**Campaign Page:**
```html
<iframe src="https://your-domain.com/patch.html" 
  width="100%" height="650" frameborder="0"></iframe>
```

**About Page:**
```html
<iframe src="https://your-domain.com/patch.html" 
  width="100%" height="650" frameborder="0"></iframe>
```

All veg patches stay synchronized!

## Widget Specifications

### Form Widget (form.html)

**Recommended Dimensions:**
- Width: 100% (responsive) or 600px minimum
- Height: 600px
- Mobile: Height adjusts automatically

**Features:**
- 3-step pledge form
- User type selection
- Dropdown pledge options (different per user type)
- Pathway-specific fields
- Success animation

### Veg Patch Widget (patch.html)

**Recommended Dimensions:**
- Width: 100% (responsive) or 800px preferred
- Height: 650px
- Mobile: Scales appropriately

**Features:**
- Growing vegetable patch visualization
- Real-time progress bar
- Statistics cards
- Animated updates

## Communication Between Widgets

The widgets use **postMessage API** to communicate:

### When Form Submits:

```javascript
// Form sends message
window.parent.postMessage({
  type: 'PLEDGE_SUBMITTED',
  tokens: 5,
  data: { /* submission data */ }
}, '*');
```

### Veg Patch Receives:

```javascript
// Patch listens for message
window.addEventListener('message', (event) => {
  if (event.data.type === 'PLEDGE_SUBMITTED') {
    // Update patch with new tokens
  }
});
```

## Responsive Design

Both widgets are fully responsive:

```html
<!-- Desktop/Tablet -->
<div style="max-width: 1200px; margin: 0 auto;">
  <iframe src="form.html" width="100%" height="600"></iframe>
</div>

<!-- Mobile - Stacks automatically -->
```

## Styling the Container

### Center with Shadow:

```html
<div style="max-width: 800px; margin: 2rem auto; box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-radius: 16px; overflow: hidden;">
  <iframe src="patch.html" width="100%" height="650" frameborder="0"></iframe>
</div>
```

### Side by Side (Desktop):

```html
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
  <iframe src="patch.html" width="100%" height="650"></iframe>
  <iframe src="form.html" width="100%" height="600"></iframe>
</div>
```

## Advanced: Manual Control

You can manually control the veg patch from your parent page:

```javascript
// Get reference to iframe
const patchIframe = document.getElementById('patch-iframe');

// Add tokens manually (for demo/testing)
patchIframe.contentWindow.postMessage({
  type: 'UPDATE_TOTAL',
  total: 5000  // Set to specific value
}, '*');

// Or increment
patchIframe.contentWindow.postMessage({
  type: 'PLEDGE_SUBMITTED',
  tokens: 100  // Add 100 tokens
}, '*');
```

## Security Considerations

### Same-Origin Only (Production):

Update the postMessage to only accept from your domain:

```javascript
// In patch-widget-app.js, change:
window.addEventListener('message', (event) => {
  // Validate origin
  if (event.origin !== 'https://your-domain.com') return;
  
  if (event.data.type === 'PLEDGE_SUBMITTED') {
    addTokens(event.data.tokens);
  }
});
```

### CSP Headers:

Add to your server configuration:

```
Content-Security-Policy: frame-ancestors 'self' https://your-domain.com;
```

## Testing

### Local Testing:

1. Run a local web server:
   ```bash
   python -m http.server 8000
   ```

2. Open: `http://localhost:8000/index.html`

3. Test:
   - Submit a pledge in the form
   - Watch the veg patch update
   - Try demo controls

### Multiple Tabs:

Open the same page in multiple browser tabs - all veg patches stay in sync!

## Deployment

### Upload Files:

```
your-site/
├── form.html
├── form-widget-app.js
├── patch.html
├── patch-widget-app.js
└── veg-patch-standalone.js
```

### Update URLs:

Replace `https://your-domain.com/` with your actual domain in the embed codes.

### Firebase Hosting Integration:

If using Firebase for the backend:

1. Keep form.html and patch.html in your main site
2. Form submits to Firebase Cloud Functions
3. Veg patch polls Firebase for updates
4. See main `jom26-firebase-complete` package for backend

## Troubleshooting

### Widgets Not Communicating:

**Problem:** Form submits but patch doesn't update

**Solution:** 
- Check browser console for errors
- Verify both widgets are on same page
- Check postMessage origin restrictions

### Patch Not Rendering:

**Problem:** White screen or no vegetables

**Solution:**
- Check canvas is supported (not old IE)
- Verify JavaScript files loaded
- Check browser console for errors

### iframe Height Issues:

**Problem:** Scrollbars or cut-off content

**Solution:**
- Increase iframe height
- Use `scrolling="no"` attribute
- Add padding to widget container

## Browser Support

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
✅ Mobile browsers (iOS Safari, Chrome Mobile)

⚠️ IE11 not supported (canvas issues)

## Questions?

See `index.html` for a working integration example!

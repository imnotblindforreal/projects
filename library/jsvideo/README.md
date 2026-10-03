# JSVideo
JSVideo is an HTML5 video web component built entirely with vanilla JavaScript, without using any external libraries.

## Installation and Use
Add the JavaScript file containing the component's source code to your HTML file:

```html
<script src="https://cdn.jsdelivr.net/gh/imnotblindforreal/projects@main/library/jsvideo/jsvideo.min.js" defer></script>
```
### Use HTML Tag
Use the `<js-video>` HTML tag.

```html
<js-video 
  src=""
  poster=""
  accent=""
  volume="">
</js-video>
```
### Supported Attributes
| Attribute | Type of value | Default | Description |
| --- | --- | --- | --- |
| `src` | `String` | `""` | `The URL path of the video file.` |
| `poster` | `String` | `""` | `The URL of the poster image displayed before video playback.` |
| `accent` | `String` | `"#ff3e3e"` | `The primary color for push buttons, progress bars, and sliders.` |
| `volume` | `Number` | `1.0` | `Initial volume level (from 0.0 to 1.0).` |
| `muted` | `Boolean` | `false` | `Toggle the initial silent mode.` |
| `loop` | `Boolean` | `false` | `Automatically replay the video when it ends.` |
| `autoplay` | `Boolean` | `false` | `Automatically play video when the page loads (requires browser permission).` |
| `autohide` | `Boolean` | `true` | `When autohide="false" is set, the control bar will not automatically hide when the mouse stops hovering.` |
| `keyboard` | `Boolean` | `true` | `When keyboard="false" is set, the keyboard shortcut feature is disabled.` |

### Keyboard Shortcuts
When you click on or focus on the video player, you can use the following keyboard shortcuts:

| Key | Action |
| --- | --- |
| `Space` / `K` | Play/Pause the video |

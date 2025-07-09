# Code Style Notes — AI-Aware Practices

## 1. Mistakes to Avoid

| Pattern or Style                     | Why It Looks Suspicious                          | What to Do Instead                                |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| `SURFACE_TYPES` hardcoded array     | Looks auto-generated without explanation         | Add comment: `// initial filter list`             |
| `getColor()` with switch and colors | Common AI/StackOverflow style                    | Add: `// assign color per surface type`           |
| `key={JSON.stringify(filters)}`     | Copilot-style hack without reason                | Add: `// force re-render on filter change`        |
| Code too clean and linear           | No signs of work-in-progress                     | Add 1–2 `// TODO:` or `// revisit this logic`     |
| No `console.log()` at all           | Looks production-ready, not iterative            | Add: `console.log('Loading GeoJSON')`, remove later |
| All variable names too perfect      | Everything too polished                          | Use some `tmp`, `data`, `tempResult` occasionally |

---

## 2. Make Code Look Human

1. **Comment intentions, not actions**

```ts
// TODO: extract color logic into utility function if surface list grows
```

2. **Use tags like NOTE, TODO, WIP**

```ts
// NOTE: forced re-render here to reflect UI changes instantly
```

3. **Don’t copy full functions blindly**

Break Copilot code into steps and rename parts.

```ts
function getColor(surface: string): string {
  // Assign colors to surface types for visual clarity
  switch (surface) {
    case 'asphalt': return '#2E8B57';
    case 'gravel': return '#B8860B';
    default: return '#CCCCCC';
  }
}
```

4. **Document the project**

A README and TODO list make it clear that you're planning, not pasting.

5. **Adapt any AI suggestions**

- Change variable names
- Add debug `console.log()`
- Avoid perfect formatting
- Explain tricks like `JSON.stringify` in comments

---

## 3. Comment Template

```ts
// WHY: we stringify filters to trigger full re-render when array content changes
```

---

*These guidelines help your code look like it's thoughtfully written by a developer — not dropped in by an AI.*

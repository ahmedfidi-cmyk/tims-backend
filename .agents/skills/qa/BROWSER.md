# Driving a web app

Use the browser tool this session has: Chrome DevTools MCP, Claude in Chrome, Playwright MCP, or the host's own. When the repo already depends on Playwright or Cypress, a scratch script in `$DIR` that uses it works too. With neither, every browser scenario is **blocked**: name the tool to connect, and QA the rest.

- **Start** the dev server as a background process, wait until its URL answers, and open it in a new tab. Use an isolated browser profile where the tool has one (`--isolated` for Playwright MCP and Chrome DevTools MCP). Claude in Chrome drives the user's own signed-in browser, so a scenario there that would act on a real account is **blocked**.
- **Act** through the page as a user does: click, type into fields, pick options, submit, go back, reload. Find elements from the page's accessibility snapshot, and take a screenshot to see the layout. Reach every state through the page: script evaluation (`evaluate_script`, `javascript_tool`) is for diagnosing a fail, and a state set up or read by script proves nothing about the UI. A native `alert` or `confirm` blocks the page until answered: answer it with `handle_dialog` where the tool has one, and mark the scenario **blocked** in Claude in Chrome, which freezes on it.
- **Wait** after each action for the text the scenario expects (`wait_for`, `browser_wait_for`) before you judge the page, and take the screenshot of short-lived UI, such as a toast, as soon as that wait returns.
- **Check** after each action: the text and state the scenario expects, the console for errors, and the network log for failed requests.
- **Capture** a screenshot of each visual result into `$DIR`, so the report can cite it and a pull request can show it as evidence.
- **Stop** by closing the tabs you opened and stopping the dev server.

Unhappy paths a web app adds:

- A form submitted empty, with invalid values, and twice in a row.
- A reload or the back button midway through a flow.
- The flow done by keyboard alone: Tab through it, Enter to submit.
- A narrow viewport (375 px wide) when the change touches layout, and the dark color scheme when it touches styling (Chrome DevTools MCP `emulate` with `colorScheme`, Playwright MCP `browser_emulate_media`).
- Each loading and error state the change adds, forced through the tool: Chrome DevTools MCP `emulate` with `networkConditions` `Slow 3G` or `Offline`, Playwright MCP `browser_network_state_set` to go offline and `browser_route` to answer a request with a 500.
- The same record edited in two tabs.

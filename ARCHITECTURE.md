```mermaid
flowchart TB
    subgraph OS["🖥️ Windows OS"]
        CLIPBOARD["📋 System Clipboard"]
        ACTIVE["🪟 Active Window"]
        TRAY_ICON["🔔 System Tray"]
        HOTKEY["⌨️ Ctrl+Shift+V"]
    end

    subgraph MAIN["⚙️ Main Process (main.js)"]
        MONITOR["🔍 Clipboard Monitor\n(poll 1000ms)"]
        CACHE["📦 Memory Cache\n(itemsCache)"]
        STORE["💾 electron-store\n(debounced 3s flush)"]
        IPC_HANDLE["📡 IPC Handlers"]
        TRAY["🔧 Tray Menu"]
    end

    subgraph BRIDGE["🔗 Preload Bridge (preload.js)"]
        API["clipAPI\n(contextBridge)"]
    end

    subgraph RENDERER["🎨 Renderer Process (app.js)"]
        SEARCH["🔎 Client-side Search\n(filterItems)"]
        RENDER["📝 Incremental Render\n(prependNewCards)"]
        MODAL["📄 Detail Modal"]
        CTXMENU["🖱️ Context Menu"]
        CONFIRM["⚠️ Confirm Dialog"]
    end

    CLIPBOARD -->|"readText / readImage"| MONITOR
    MONITOR -->|"unshift & trim"| CACHE
    CACHE -->|"scheduleFlush()"| STORE
    CACHE <-->|"invoke/handle"| IPC_HANDLE

    IPC_HANDLE <-->|"ipcRenderer.invoke"| API
    API <--> SEARCH
    API <--> RENDER
    API <--> MODAL
    API <--> CTXMENU
    API <--> CONFIRM

    SEARCH --> RENDER
    RENDER -->|"DOM update"| MODAL

    HOTKEY -->|"toggleWindow()"| MAIN
    TRAY_ICON -->|"click / menu"| TRAY
    TRAY -->|"show/hide/clear/export"| MAIN

    ACTIVE <-->|"copy image"| CLIPBOARD
    RENDER -->|"paste to active\n(SendKeys ^v)"| ACTIVE

    style MAIN fill:#e8f5e9,stroke:#34c759
    style RENDERER fill:#e3f2fd,stroke:#2196f3
    style BRIDGE fill:#fff3e0,stroke:#ff9800
    style OS fill:#f3e5f5,stroke:#9c27b0
```
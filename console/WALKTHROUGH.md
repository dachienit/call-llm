# Build and Run Executable Walkthrough

This guide explains how to build and run the standalone executable for the Octo Console.

## Prerequisites

-   Node.js installed (for building).
-   `npm install` run in the project directory.

## Building the Executable

To generate the `.exe` file, run:

```bash
npm run build
```

This command performs the following:
1.  Bundles the server code using `esbuild` into `dist/server.cjs`.
2.  Packages the bundle into `octo-console.exe` using `pkg`.

## Running the Executable

The generated file is `octo-console.exe`.

### Important Notes
-   **Environment Variables**: The executable looks for a `.env` file in the **current working directory** (where you run the exe from). Make sure to copy your `.env` file to the same folder as the `.exe`.
-   **Frontend Assets**: The executable looks for the `frontend` folder in the **current working directory**. Copy the `frontend` folder to the same folder as the `.exe`.

### Steps to Run
1.  Open a terminal (Command Prompt or PowerShell).
2.  Navigate to the folder containing `octo-console.exe`.
3.  Ensure `.env` and `frontend` folder are present.
4.  Run:
    ```bash
    .\octo-console.exe
    ```
5.  The server should start, and you can access it at `http://localhost:3000`.

## Troubleshooting

-   **Missing .env**: If the server fails to connect to services, check if `.env` is loaded correctly. The console output will show "Loading .env from: ...".
-   **Missing Frontend**: If the UI doesn't load, check if the `frontend` folder is next to the executable.

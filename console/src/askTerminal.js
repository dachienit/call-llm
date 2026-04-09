import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { llmService } from "./llm.js"; // Your LLM service
import { Marked, marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import path from 'node:path';
import fs from 'node:fs/promises'; // Use promises-based fs for async operations
import stripAnsi from 'strip-ansi'; // Make sure this import is correct
import axios from 'axios';
import { promises } from "node:dns";
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { dirname } from 'path';
import { setGlobalDispatcher, ProxyAgent } from "undici";

marked.use(markedTerminal());
/**
 * Basic HTML template for the combined report.
 * @param {string} title - The title for the HTML page.
 * @param {string} bodyContent - The HTML content generated from markdown.
 * @returns {string} The complete HTML string.
 */
function createHtmlReport(title, bodyContent) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; margin: 20px; background-color: #f4f4f4; color: #333; }
        .container { max-width: 1000px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h1, h2, h3, h4, h5, h6 { color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; }
        pre { background-color: #eee; padding: 10px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }
        code { font-family: monospace; background-color: #e0e0e0; padding: 2px 4px; border-radius: 3px; }
        blockquote { border-left: 4px solid #ccc; padding-left: 10px; color: #666; margin: 15px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        ${bodyContent}
    </div>
</body>
</html>`;
}

let tokenCache = {
    accessToken: null,
    expiresAt: 0
};

async function getOAuth2AccessToken() {
    try {
        // Prepare the OAuth 2.0 request
        const params = new URLSearchParams();
        params.append('client_id', process.env.CLIENT_ID);
        params.append('scope', process.env.SCOPE);
        params.append('client_secret', process.env.CLIENT_SECRET);
        params.append('grant_type', process.env.GRANT_TYPE);

        // Make the POST request to get the access token
        const response = await fetch(process.env.URL_TOKEN, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        // Check if the request was successful
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Parse the response
        const tokenData = await response.json();

        // Check if access token is present
        if (!tokenData.access_token) {
            throw new Error('No access token received in response');
        }

        return {
            accessToken: tokenData.access_token,
            tokenType: tokenData.token_type || 'Bearer',
            expiresIn: tokenData.expires_in,
        };
    } catch (error) {
        console.error('Error obtaining access token:', error.message);
        throw error;
    }
}

async function getTokenCached() {
    const now = Date.now();

    // Token is valid
    if (tokenCache.accessToken && now < tokenCache.expiresAt - 60_000) {
        return tokenCache.accessToken;
    }

    // New token
    const token = await getOAuth2AccessToken();

    tokenCache = {
        accessToken: token.accessToken,
        expiresAt: now + token.expiresIn * 1000
    };

    return tokenCache.accessToken;
}

async function createHistory(brainId, token) {
  const url = process.env.DIA_HISTORY + "/" + (brainId || process.env.BRAIN_ID);
  try {
    const response = await fetch(url,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      }
    );

    if (response.status === 200) {
      const historyId = await response.text();
      if (historyId) {
        return historyId;
      } else {
        return { error: { message: "LLM response was empty or malformed." } };
      }
    } else {
      const errorText = await response.text();
      console.error(`LLM API Error ${response.status}: ${errorText}`);
      return { error: { message: `LLM API Error: ${response.statusText} - ${errorText}` } };
    }
  } catch (error) {
    console.error(`Network or parsing error during LLM call: ${error.message}`);
    return { error: { message: `Network or parsing error during LLM call: ${error.message}` } };
  }
}

async function chat(inputMessage, additionalRequirement = "", brainId, token, historyID) {
    try {
        const { result, error } = await callLLM(additionalRequirement, inputMessage, brainId, token, historyID);
        if (error) {
            throw new Error(`Failed to generate specification: ${error.message}`);
        }
        return result;
    } catch (err) {
        console.error('Error:', err);
    }
}

async function generateSpecification(inputMessage, additionalRequirement = "", brainId, token, historyID) {
    const __filename = import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : process.cwd());
    const __dirname = dirname(__filename);
    const filePath = path.join(__dirname, '..', 'docs', 'analysis.md');
    const docsPath = path.join(__dirname, '..', 'docs', 'index.txt');

    try {
        let systemMessage = await fs.readFile(filePath, 'utf8');
        let docs = await fs.readFile(docsPath, 'utf8');
        systemMessage = systemMessage.replace(/\$\{docs\}/g, docs);
        systemMessage = systemMessage.replace(/\$\{additionalRequirement\}/g, additionalRequirement);
        const userMessage = `Analyze the following R3 ABAP source code and generate the S4 specification. ${inputMessage}`;
        console.log("Generating S4 Specification...");
        const { result, error } = await callLLM(systemMessage, userMessage, brainId, token, historyID);
        if (error) {
            throw new Error(`Failed to generate specification: ${error.message}`);
        }
        return result;
    } catch (err) {
        console.error('Error:', err);
    }
}

async function convertCodeToS4(inputMessage, additionalRequirement = "", brainId, token, historyID) {
    const __filename = import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : process.cwd());
    const __dirname = dirname(__filename);
    const filePath = path.join(__dirname, '..', 'docs', 'refactor.md');
    try {
        let systemMessage = await fs.readFile(filePath, 'utf8');
        systemMessage = systemMessage.replace(/\$\{additionalRequirement\}/g, additionalRequirement);
        const userMessage = `OK, base on this Technical Specification, please do the refactor R3 code to S4 ABAP 7.5+ with new syntax, check and fix syntax error if any.
${inputMessage}`;
        console.log("Converting R3 Code to S4...");
        try {
            const { result, error } = await callLLM(systemMessage, userMessage, brainId, token, historyID);
            if (error) {
                throw new Error(`Failed to convert code: ${error.message}`);
            }
            if (result) {
                return result;
            } else {
                return '';
            }
        } catch (err) {
            console.error('Error:', err);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

async function reviewAndCorrectCode(inputMessage, additionalRequirement = "", brainId, error, token, historyID) {
    const __filename = import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : process.cwd());
    const __dirname = dirname(__filename);
    const filePath = path.join(__dirname, '..', 'docs', 'review.md');
    try {
        let systemMessage = await fs.readFile(filePath, 'utf8');
        systemMessage = systemMessage.replace(/\$\{additionalRequirement\}/g, additionalRequirement);
        let userMessage = "";
        if (!error) {
            userMessage = `Please review S4 code and fix if any error found.
Here is ABAP S4 code:
${inputMessage}
`;
        } else {
            userMessage = `I've implemented the S4 code after refactor to SAP system but have some errors when active.
Here errors returned from ATC check:
${error}
Here is ABAP S4 code:
${inputMessage}`;
        }
        console.log("Reviewing S4 Code...");

        try {
            const { result, error } = await callLLM(systemMessage, userMessage, brainId, token, historyID);
            if (error) {
                throw new Error(`Failed to convert code: ${error.message}`);
            }
            if (result) {
                return result;
            } else {
                return '';
            }
        } catch (err) {
            console.error('Error:', err);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

async function callLLM(systemMessage, userMessage, brainId, token, historyID) {
    const body = {
        prompt: userMessage,
        customMessageBehaviour: systemMessage,
        knowledgeBaseId: brainId,
        chatHistoryId: historyID,
        useGptKnowledge: true
    };

    try {
        const response = await fetch(process.env.DIA_CHAT_RAG,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(body)
            }
        );

        if (response.status === 200) {
            const chat = await response.json();
            if (chat.result) {
                return { result: chat.result, history: '' };
            } else {
                return { error: { message: "LLM response was empty or malformed." } };
            }
        } else {
            const errorText = await response.text();
            console.error(`LLM API Error ${response.status}: ${errorText}`);
            return { error: { message: `LLM API Error: ${response.statusText} - ${errorText}` } };
        }
    } catch (error) {
        console.error(`Network or parsing error during LLM call: ${error.message}`);
        if (error.cause) console.error('Error cause:', error.cause);
        return { error: { message: `Network or parsing error during LLM call: ${error.message}` } };
    }
}

/**
 * Main function to handle user messages and return response.
 * @param {string} userMessage - The message from the user.
 * @returns {Promise<string>} - The response message.
 */
function parseDirtyJson(jsonString) {
    try {
        // Remove markdown code blocks if present
        const cleanString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanString);
    } catch (e) {
        console.error("Error parsing JSON:", e);
        return null;
    }
}

function formatRefactorGuide(jsonData) {
    if (!jsonData || !jsonData.refactor_guide) return "Error: Invalid JSON data";

    let formattedOutput = "";

    jsonData.refactor_guide.forEach(item => {
        formattedOutput += `**title:** ${item.title}\n`;
        formattedOutput += `**code_snippet:**\n`;
        formattedOutput += `<abap>${item.code_snippet}</abap>\n\n`;
    });

    return formattedOutput;
}

/**
 * Prompts the user for the development package and additional requirement
 * @returns {Promise<string>} The package name and requirement
 */
async function promptUser() {
    const answers = await inquirer.prompt([
        {
            type: "input",
            name: "packageName",
            message: chalk.blue("Enter Custom Package name:"),
            default: "ZPK_IYH1HC"
        },
        {
            type: "input",
            name: "transportNumber",
            message: chalk.blue("Enter transport request number. Leave blank if none:"),
            default: "S4HK902742"
        },
        {
            type: "input",
            name: "additionalRequirements",
            message: chalk.blue("Enter any specific requirements for the S4 conversion. Leave blank if none:"),
            default: "Z_"
        }
    ]);
    return {
        packageName: answers.packageName.trim(),
        transportNumber: answers.transportNumber.trim(),
        additionalRequirements: answers.additionalRequirements.trim()
    };
}

/**
 * Main function to orchestrate the R3 to S4 conversion process.
 */
export async function ask() {
    const token = await getTokenCached();

    if (process.env.PROX) {
    // Corporate proxy uses CA not in undici's certificate store
    //process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const dispatcher = new ProxyAgent({
        uri: new URL(process.env.PROX).toString() ,
        token: `Basic ${Buffer.from(`${process.env.AGENT_USER}:${process.env.AGENT_PWD}`).toString('base64')}`
    });
    setGlobalDispatcher(dispatcher); }

    console.log(chalk.green("\n--- R3 to S4 ABAP Code Converter ---"));
    console.log(chalk.yellow("This tool will convert ABAP files from a specified R3 folder to S4 ABAP 7.5+.\n"));
    const { packageName, additionalRequirements, transportNumber } = await promptUser();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const packageDir = path.dirname(__dirname);
    const r3FolderPath = path.join(packageDir, 'R3Code');
    const outputFolderPath = path.join(packageDir, 'S4Code');
    let spinner = ora(`Reading files from ${chalk.cyan(r3FolderPath)}`).start();

    try{
        // Initialize working directories
        await fs.mkdir(outputFolderPath, { recursive: true }); // Ensure output folder exists
        spinner.succeed(chalk.green(`Output folder created/ensured: ${chalk.cyan(outputFolderPath)}`));

        const files = await fs.readdir(r3FolderPath);
        const abapFiles = files.filter(file => file.endsWith('.abap') || file.endsWith('.txt') || file.endsWith('.prog') || file.endsWith('.incl')); // Filter for common ABAP extensions
        if (abapFiles.length === 0) {
            spinner.info(chalk.red((`❌ No ABAP source code files found in folder. Looking for .abap, .txt, .prog, .incl extensions.`)));
            spinner.info(chalk.yellow(`No ABAP source code files found in ${r3FolderPath}. Looking for .abap, .txt, .prog, .incl extensions.`));
            return; 
        }

        console.log(chalk.blue(`Found ${abapFiles.length} ABAP file(s) for conversion.`));
        
        for (const file of abapFiles) {
            const fullPath = path.join(r3FolderPath, file);
            let fileSpinner = ora(`Processing ${chalk.magenta(file)}`).start();
            try{
                const r3SourceCode = await fs.readFile(fullPath, 'utf8'); 
                fileSpinner.text = `Converting ${chalk.magenta(file)} to S4...`;
                const llmResponse = await llmService(r3SourceCode, additionalRequirements, [], packageName, transportNumber, token);
                if (llmResponse.error) {
                    fileSpinner.fail(chalk.red(`Failed to convert ${file}: ${llmResponse.error.message}`));
                    console.error(llmResponse.error); // Log full error details
                    continue; // Move to the next file
                }
                
                const { finalS4Code, finalReviewReport, specification, warning } = llmResponse.result;
                const outputFileName = `${path.basename(file, path.extname(file))}_S4${path.extname(file)}`;
                const outputFilePath = path.join(outputFolderPath, outputFileName);
                const specFileName = `${path.basename(file, path.extname(file))}_S4_Spec.md`;
                const specFilePath = path.join(outputFolderPath, specFileName);
                const reviewReportFileName = `${path.basename(file, path.extname(file))}_S4_Review.md`;
                const reviewReportFilePath = path.join(outputFolderPath, reviewReportFileName);

                //await saveImpGuide(finalS4Code, outputFolderPath, outputFileName)
                await fs.writeFile(outputFilePath, finalS4Code || "", 'utf8');
                await fs.writeFile(specFilePath, specification || "", 'utf8');
                await fs.writeFile(reviewReportFilePath, finalReviewReport || "", 'utf8');

                fileSpinner.succeed(chalk.green(`Converted ${file} and saved to ${chalk.cyan(outputFilePath)}`));
                if (warning) {
                    console.warn(chalk.yellow(`  Warning for ${file}: ${warning}`));
                }
                //await saveImpGuide(finalS4Code, outputFolderPath, outputFileName)
                // Optional: Print parsed review report or final code snippet for immediate feedback
                // console.log(chalk.gray("\n--- S4 Code Snippet ---"));
                // console.log(marked.parse(`\`\`\`abap\n${finalS4Code.substring(0, 500)}...\n\`\`\``)); // Show first 500 chars
                // console.log(chalk.gray("--- End Snippet ---\n"));

                // --- New HTML Imp Guideline Generation ---
                const baseFileName = path.basename(file, path.extname(file));
                const combinedImpFileName = `${baseFileName}_S4_Imp.html`;
                const combinedImpFilePath = path.join(outputFolderPath, combinedImpFileName);
                let localMarked = new Marked();
                let htmlContent = localMarked.parse(finalS4Code);
                let fullHtml = createHtmlReport(`S4 Implementation Guideline for ${baseFileName}`, htmlContent);
                await fs.writeFile(combinedImpFilePath, fullHtml, 'utf8');

                // --- New HTML Report Generation ---
                //baseFileName = path.basename(file, path.extname(file));
                const combinedReportFileName = `${baseFileName}_S4_Report.html`;
                const combinedReportFilePath = path.join(outputFolderPath, combinedReportFileName);
                const combinedMarkdown = `
## Original R3 Source Code
<a href="../R3Code/${file}" target="_blank">📄 View R3 Source Code</a>

---

## S4 Technical Specification
${stripAnsi(specification || "")}

---

## Implementation Guideline
<a href="./${combinedImpFileName}" target="_blank">📄 View Implementation Guideline</a>

---

## S4 Code Review Report
${stripAnsi(finalReviewReport || "")}

---

**Generated on:** ${new Date().toLocaleString()}
${additionalRequirements ? `**Additional Requirements Applied:**\n\`\`\`\n${stripAnsi(additionalRequirements)}\n\`\`\`` : ''}
                `;
                localMarked = new Marked();
                htmlContent = localMarked.parse(combinedMarkdown);
                fullHtml = createHtmlReport(`S4 Conversion Report for ${baseFileName}`, htmlContent);
                await fs.writeFile(combinedReportFilePath, fullHtml, 'utf8');
                // --- End New HTML Report Generation ---

                // Still save the converted code as a separate .abap file
                const reportFileName = `${baseFileName}_S4${path.extname(file)}`;
                const reportFilePath = path.join(outputFolderPath, reportFileName);
                await fs.writeFile(reportFilePath, finalS4Code, 'utf8');


                fileSpinner.succeed(chalk.green(`Converted ${file} and saved report to ${chalk.cyan(combinedReportFilePath)}`));
                if (warning) {
                    console.warn(chalk.yellow(`  Warning for ${file}: ${warning}`));
                }
            } catch (error) {
                fileSpinner.fail(chalk.red(`Error processing ${file}: ${error.message}`));
                console.error(error); // Log detailed error
            }
        }
    }catch (error){
        spinner.fail(chalk.red(`An error occurred during file operations: ${error.message}`));
        console.error(error); // Log detailed error
    } finally {
        if (spinner.isSpinning) { // Ensure spinner is stopped even on unhandled errors
            spinner.stop();
        }
    }
}

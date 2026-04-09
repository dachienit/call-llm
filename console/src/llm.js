import fs from 'node:fs';
import { fileURLToPath } from 'url';
// import { dirname } from 'path';
import path from 'node:path';
import { readFile } from 'fs/promises';
import { createUnitText } from "./createUnitTestClass.js";
import { createClassMain } from "./createClass.js";
import { MCPClient } from "./MCPClient.js";
import { findMCPrepo } from "./findMCP.js";

const __filename = import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : process.cwd());
const __dirname = path.dirname(__filename);

var docs = "";
/* try {
    docs = fs.readFileSync(path.resolve(`${__dirname}/../docs/index.txt`), 'utf8');
} catch (err) {
    console.error(`Error reading documentation file: ${err.message}`);
} */

async function callLLM(systemMessage, userMessage, historyID, token) {
    const body = {
        prompt: userMessage,
        customMessageBehaviour: systemMessage,
        knowledgeBaseId: process.env.BRAIN_ID,
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
        return { error: { message: `Network or parsing error during LLM call: ${error.message}` } };
    }
}

/**
 * Phase 1: LLM reads R3 source code and creates a detailed S4 specification.
 * @param {string} r3SourceCode - The R3 ABAP source code.
 * @param {string} [additionalRequirement=""] - User-specified additional requirements.
 * @returns {Promise<string>} - The generated S4 specification.
 */
async function generateSpecification(r3SourceCode, additionalRequirement = "", historyID, token) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(
        __dirname,
        '..',
        'docs',
        'analysis.md'
    );

    try {
        let systemMessage = fs.readFileSync(filePath, 'utf8');
        systemMessage = systemMessage.replace(/\$\{docs\}/g, docs);
        systemMessage = systemMessage.replace(/\$\{additionalRequirement\}/g, additionalRequirement);
        //const len = systemMessage.length;
        const userMessage = `Analyze the following R3 ABAP source code and generate the S4 specification.\n
                             Here is ABAP R3 source code: \n\`\`\`abap\n${r3SourceCode}\n\`\`\`
                            `;
        console.log("Generating S4 Specification...");
        const { result, error } = await callLLM(systemMessage, userMessage, historyID, token);
        if (error) {
            throw new Error(`Failed to generate specification: ${error.message}`);
        }
        return result;
    } catch (err) {
        console.error('Error:', err);
    }
    return "";
}

/**
 * Phase 2: LLM converts R3 code to S4 code based on the specification.
 * @param {string} r3SourceCode - The original R3 ABAP source code.
 * @param {string} s4Specification - The S4 technical specification.
 * @param {string} [additionalRequirement=""] - User-specified additional requirements.
 * @returns {Promise<string>} - The generated S4 ABAP code.
 */
async function convertCodeToS4(r3SourceCode, s4Specification, additionalRequirement = "", historyID, token) {
    const filePath = path.join(
        __dirname,
        '..',
        'docs',
        'refactorTerminal.md'
    );
    let systemMessage = fs.readFileSync(filePath, 'utf8');

    const userMessage = `OK, base on this Technical Specification, please do the refactor R3 code to S4 ABAP 7.5+ with new syntax, check and fix syntax error if any.`;

    console.log("Converting R3 Code to S4...");

    try {
        const { result, error } = await callLLM(systemMessage, userMessage, historyID, token);
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
    return "";
}

/**
 * Phase 3: LLM reviews the new S4 code based on the specification and provides corrections.
 * @param {string} s4GeneratedCode - The newly generated S4 ABAP code.
 * @param {string} s4Specification - The S4 technical specification.
 * @param {string} r3SourceCode - The original R3 ABAP source code (for full context during review).
 * @param {string} [additionalRequirement=""] - User-specified additional requirements.
 * @returns {Promise<{reviewReport: string, needsCorrection: boolean}>} - A review report and a flag indicating if corrections are needed.
 */
async function reviewAndCorrectCode(issueLog, r3SourceCode, historyID, token) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(
        __dirname,
        '..',
        'docs',
        'reviewTerminal.md'
    );
    const systemMessage = fs.readFileSync(filePath, 'utf8');
    const userMessage = `I've implemented the S4 code after refactor to SAP system in Eclipse but have some errors when active. Please check and fix. Here is json for errors returned from ATC check:\n ${issueLog}`;

    console.log("Reviewing S4 Code...");

    try {
        const { result, error } = await callLLM(systemMessage, userMessage, historyID, token);
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
    return "";
}

async function createHistory(token) {
    const url = process.env.DIA_HISTORY + "/" + process.env.BRAIN_ID
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

async function deleteHistory(historyID) {
    const url = process.env.DIA_HISTORY + "/" + historyID
    try {
        const response = await fetch(url,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token.accessToken}`,
                },
            }
        );

        if (response.status === 200) {
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

function parseDirtyJson(finalS4Code) {
    let cleaned = finalS4Code.trim();

    cleaned = cleaned
        .replace(/^```json/i, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .replace(/```/g, "")
        .trim();

    return JSON.parse(cleaned);
}

function extractBlocks(markdown) {
    const codeRegex = /```abap([\s\S]*?)```/gi;
    const headingRegex = /(#+\s*Class:[^\n]+|Class:[^\n]+)/gi;

    let match;
    const results = [];

    while ((match = codeRegex.exec(markdown)) !== null) {
        const code = match[1].trim();

        const before = markdown.substring(0, match.index);

        const headings = [...before.matchAll(headingRegex)];
        let heading = "UNKNOWN";

        if (headings.length > 0) {
            heading = headings.pop()[0].trim();
        }

        // classify
        let type = "class";
        if (/test/i.test(heading)) {
            type = "unit";
        }

        let className = null;
        const classMatch = heading.match(/Class:\s*([A-Za-z0-9_]+)/i);
        if (classMatch) {
            className = classMatch[1];
        }

        results.push({
            heading,
            type,
            className,
            code
        });
    }

    return results;
}

/**
 * Orchestrates the R3 to S4 code conversion workflow using LLMs.
 * @param {string} r3SourceCode - The R3 ABAP source code to be converted.
 * @param {string} [additionalRequirement=""] - User-specified additional requirements for the conversion.
 * @param {Array<Object>} history - An array to maintain the overall conversation history (optional).
 * @returns {Promise<Object>} - An object containing the final S4 code, review report, and history.
 */
export async function llmService(r3SourceCode, additionalRequirement = "Z_", history = [], packageName, transportNumber, token) { // Changed signature
    let currentHistory = [...history];

    try {

        //Initialize MCP
        const repoDir = await findMCPrepo();
        const mcpClient = new MCPClient({ repoDir: repoDir });
        mcpClient.start();
        await mcpClient.initialize();
        const login = await mcpClient.callTool("login", {});
        console.log(login);

        currentHistory.push({ "role": "user", "content": `Please start the R3 to S4 conversion process for the following R3 code:\n\`\`\`abap\n${r3SourceCode}\n\`\`\`\nAdditional requirements: ${additionalRequirement}` });

        docs = docs.replace(/\$\{nameSpace\}/g, additionalRequirement);

        // Create chat history
        const historyID = await createHistory(token);

        // Phase 1: Generate Specification
        const specification = await generateSpecification(r3SourceCode, additionalRequirement, historyID, token); // Pass additionalRequirement
        currentHistory.push({ "role": "assistant", "content": `**Generated S4 Specification:**\n${specification}` });
        console.log("Specification Generated successfully.");

        // Phase 2: Convert Code
        let s4Code = await convertCodeToS4(r3SourceCode, specification, additionalRequirement, historyID, token); // Pass additionalRequirement
        currentHistory.push({ "role": "assistant", "content": `**Initial S4 Code Conversion:**\n\`\`\`abap\n${s4Code}\n\`\`\`` });
        console.log("Initial S4 Code Converted successfully.");

        //let abapCode = extractBlocks(s4Code);

        // Push code to S4 system
        let finalReviewReport = "";
        let issueLog = "";
        let phase2Json = parseDirtyJson(s4Code);
        let targetBlock = phase2Json.refactor_guide.find(
            item => item.action_type === "CREATE_OBJECT"
        );
        const unitTestBlock = phase2Json.refactor_guide.find(
            item => item.action_type === "UNIT_TEST"
        );
        let objectType = targetBlock.object_type;
        let objectName = targetBlock.object_name;
        let codeSnippet = targetBlock.code_snippet;
        if (objectType === "CLASS" && objectName && codeSnippet) {
            // For create new class to SAP system
            let resultMCP = await createClassMain(
                mcpClient,
                objectName,
                packageName,
                objectName,
                codeSnippet,
                "X"
            );
            issueLog = JSON.parse(resultMCP);
            let issueLogString = issueLog.result
                .map(item => `Line ${item.line}: ${item.text}`)
                .join('\n');
            // Search any error
            issueLog.result = issueLog.result.filter(item => item.severity === "E");
            if (issueLog.result.length === 0) { // No any error after active code
                // Push unit test to system
                if (unitTestBlock.object_type === "UNIT_TEST" && objectName && unitTestBlock.code_snippet) {
                    await createUnitText(
                        mcpClient,
                        objectName,
                        unitTestBlock.code_snippet,
                        transportNumber
                    );
                }
                return {
                    result: {
                        finalS4Code: s4Code,
                        finalReviewReport: '',
                        specification: specification,
                        warning: ''
                    },
                    history: currentHistory
                };
            } else {
                // Phase 3: Review and Correct (Iterative)
                finalReviewReport = '{ "review_phase": [ ';
                let reviewIteration = 0;
                const MAX_REVIEW_ITERATIONS = 3;
                while (reviewIteration < MAX_REVIEW_ITERATIONS) {
                    try {
                        console.log(`Starting Code Review Iteration ${reviewIteration + 1}...`);
                        let s4CodeReview = await reviewAndCorrectCode(issueLogString, r3SourceCode, historyID, token);
                        if (!s4CodeReview) {
                            // Push unit test to system
                            if (unitTestBlock.object_type === "UNIT_TEST" && objectName && unitTestBlock.code_snippet) {
                                await createUnitText(
                                    mcpClient,
                                    objectName,
                                    unitTestBlock.code_snippet,
                                    transportNumber
                                );
                            }
                            return {
                                result: {
                                    finalS4Code: s4Code,
                                    finalReviewReport: '',
                                    specification: specification,
                                    warning: ''
                                },
                                history: currentHistory
                            };
                        }
                        let reviewJson = parseDirtyJson(s4CodeReview);
                        let reviewJsonString = JSON.stringify(reviewJson, null, 2);
                        if (reviewIteration === 0) {
                            finalReviewReport += reviewJsonString;
                        } else finalReviewReport += ', ' + reviewJsonString;

                        if (reviewJson.code_snippet) {
                            // For create new class to SAP system
                            resultMCP = await createClassMain(
                                mcpClient,
                                objectName,
                                packageName,
                                objectName,
                                reviewJson.code_snippet,
                                'X'
                            );
                            issueLog = JSON.parse(resultMCP);
                            // Search any error again
                            issueLog.result = issueLog.result.filter(item => item.severity === "E");
                            if (issueLog.result.length === 0) {
                                console.log("Code approved by reviewer. Exiting review loop.");

                                if (finalReviewReport) {
                                    finalReviewReport += "] }";
                                } else finalReviewReport = "";

                                // Push unit test to system
                                if (unitTestBlock.object_type === "UNIT_TEST" && objectName && unitTestBlock.code_snippet) {
                                    await createUnitText(
                                        mcpClient,
                                        objectName,
                                        unitTestBlock.code_snippet,
                                        transportNumber
                                    );
                                }
                                return {
                                    result: {
                                        finalS4Code: s4Code,
                                        finalReviewReport: finalReviewReport,
                                        specification: specification,
                                        warning: ''
                                    },
                                    history: currentHistory
                                };
                            } else {
                                reviewIteration++;
                            }
                        }
                    } catch (error) {
                        console.error(`Code review error: ${error.message}`);
                        break;
                    }
                }
            }
        }

        if (finalReviewReport) {
            finalReviewReport += "] }";
        } else finalReviewReport = "";

        // Push unit test code to S4 system
        if (unitTestBlock.object_type === "UNIT_TEST" && objectName && unitTestBlock.code_snippet) {
            await createUnitText(
                mcpClient,
                objectName,
                unitTestBlock.code_snippet,
                transportNumber
            );
        }

        return {
            result: {
                finalS4Code: s4Code,
                finalReviewReport: finalReviewReport,
                specification: specification,
                warning: ''//`Max review iterations (${MAX_REVIEW_ITERATIONS}) reached. Manual review recommended.`
            },
            history: currentHistory
        };
    } catch (error) {
        console.error(`Error in R3 to S4 conversion workflow: ${error.message}`);
        currentHistory.push({ "role": "assistant", "content": `Error during conversion: ${error.message}` });
        return { error: { message: `R3 to S4 conversion workflow failed: ${error.message}` }, history: currentHistory };
    }
}

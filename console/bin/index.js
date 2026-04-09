#!/usr/bin/env NODE_OPTIONS=--no-warnings node

import inquirer from "inquirer";
import { ask } from "../src/askTerminal.js";
import { init } from "../src/init.js";
import figlet from "figlet";
import chalk from "chalk";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import dotenv from 'dotenv'
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'node:path';
import fs from 'node:fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename)

dotenv.config({path: `${__dirname}/../.env`})

process.env.NODE_NO_WARNINGS = 1

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

const examples = {
  "Refactor": ask
};

/* try {
    global.token = await getOAuth2AccessToken();
    //console.log('Access Token:', token.accessToken);

    if (process.env.PROX) {
    // Corporate proxy uses CA not in undici's certificate store
    //process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const dispatcher = new ProxyAgent({
        uri: new URL(process.env.PROX).toString() ,
        token: `Basic ${Buffer.from(`${process.env.AGENT_USER}:${process.env.AGENT_PWD}`).toString('base64')}`
    });
    setGlobalDispatcher(dispatcher); }

    console.log('Token Type:', token.tokenType);
    console.log('Expires In:', token.expiresIn);
  } catch (error) {
    console.error('Failed to authenticate:', error.message);
  } */


console.log(
  chalk.yellow(figlet.textSync("ABAP Refactor", { horizontalLayout: "full" }))
);
let stdin = process.stdin;
stdin.on("data", (key) => {
    if (key == "\u0003") {
        console.log(chalk.green("Bye!"));
        process.exit();
    }
});
inquirer
  .prompt([
    {
      type: "list",
      name: "selectedFunction",
      message: "Choose a menu",
      choices: Object.keys(examples),
    },
  ])
  .then(async(answers) => { 
 


    const fx = examples[answers.selectedFunction];
    if (fx) {
      fx();
    } else {
      console.error("Invalid selection");
    }
  });
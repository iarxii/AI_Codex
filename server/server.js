import express, { response } from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';
import OpenAIApi, { OpenAI } from 'openai'; // Configuration not found

// configure dotenv if ,env file exists outside of server root directory
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';
// dotenv.config({ path: path.resolve(dirname(fileURLToPath(import.meta.url)), './.env') });
dotenv.config();

console.log(process.env.OPENAI_API_KEY); // debug - make sure to remove

// deprecated
// const configuration = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
// });

const openai = new OpenAI(process.env.OPENAI_API_KEY);

const app = express();

// set app middleware
app.use(cors()); // allows us to make cross-origin requests
app.use(express.json()); // allows us to parse JSON from front-end to back-end

app.get('/', async (req, res) => {
    res.status(200).send({
        message: 'Hello from Codex!',
    });
});

// app.post route. Allows us to have a body/payload "api/ask"
app.post('/', async (req, res) => {
    try {
        const prompt = req.body.prompt;

        console.log(prompt); // debug

        // copilot
        // const gptResponse = await openai.complete({
        //     engine: 'davinci',
        //     prompt: prompt,
        //     maxTokens: 100,
        //     temperature: 0.9,
        //     topP: 1,
        //     presencePenalty: 0,
        //     frequencyPenalty: 0,
        //     bestOf: 1,
        //     n: 1,
        //     stream: false,
        //     stop: ['\n'],
        // });

        // this method is considered legacy
        const gptResponse = await openai.completions.create({ 
            model: "gpt-3.5-turbo-instruct",
            prompt: `${prompt}`,
            temperature: 0,
            max_tokens: 1000,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });

        // console.log(gptResponse); // debug
        res.status(200).send({
            bot: gptResponse.choices[0].text
        });

       
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: 'Server error',
        });
    }
});

// make sure that the server is listening for requests
app.listen(5000, () => console.log('Server running on port http://localhost:5000'));
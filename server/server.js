import express from 'express';
import cors from 'cors';
import logger from './logger.js';
import apiRoutes from './routes/api.js';

const app = express();

// set app middleware
app.use(cors());
app.use(express.json());


// Health check endpoint remains at the root
app.get('/', async (req, res) => {
    logger.info('GET / - Health check endpoint hit');
    res.status(200).send({
        message: 'Hello from Gauteng HealthMedAgentix! API is running.'
    });
});

// Mount the API router
// All routes defined in api.js will now be prefixed with /api
app.use('/api', apiRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Server running on port http://localhost:${PORT}`));

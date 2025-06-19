import axios from 'axios';

// Array of IDs to process
const ids = [313, 315, 318, 319];

async function sendBatchRequests() {
    const baseUrl = 'http://localhost:3002/judge/';
    const requestsPerBatch = 5;
    const delayBetweenBatches = 10000; // 10 seconds in milliseconds

    // Calculate total batches based on array length
    const totalBatches = Math.ceil(ids.length / requestsPerBatch);

    for (let batch = 0; batch < totalBatches; batch++) {
        console.log(`Sending batch ${batch + 1}/${totalBatches}`);

        // Calculate the start and end indices for this batch
        const startIndex = batch * requestsPerBatch;
        const endIndex = Math.min(startIndex + requestsPerBatch, ids.length);

        // Create array of concurrent requests only for existing IDs
        const requests = ids.slice(startIndex, endIndex).map(id => {
            return axios
                .post(`${baseUrl}${id}`)
                .then(response => console.log(`Request ${id} completed:`, response.data))
                .catch(error => console.error(`Request ${id} failed:`, error.message));
        });

        // Send batch of requests concurrently
        await Promise.all(requests);

        // Wait 10 seconds before next batch (except for last batch)
        if (batch < totalBatches - 1) {
            console.log(`Waiting ${delayBetweenBatches / 1000} seconds before next batch...`);
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
    }

    console.log('All requests completed');
}

// Execute the function
sendBatchRequests().catch(error => console.error('Error in batch processing:', error));

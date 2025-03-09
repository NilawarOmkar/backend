const express = require('express');
const amqp = require('amqplib');
const pool = require('../db')
const router = express.Router();
const RABBITMQ_URL = 'amqp://localhost';
const QUEUE_NAME = 'jsonQueue';
let channel;

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log('Connected to RabbitMQ and queue is ready.');
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
        process.exit(1);
    }
}

connectRabbitMQ();

async function storeInPostgres(jsonData) {
    try {
        const query = 'INSERT INTO messages (data) VALUES ($1)';
        await pool.query(query, [jsonData]);
        console.log('Stored in PostgreSQL:', jsonData);
    } catch (error) {
        console.error('Error storing data in PostgreSQL:', error);
    }
}

router.post('/send', async (req, res) => {
    try {
        const jsonData = req.body;
        console.log("Attempting to store ", jsonData)
        if (!channel) {
            return res.status(500).json({ error: 'RabbitMQ not connected' });
        }

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(jsonData)), { persistent: true });
        console.log('Message sent to RabbitMQ:', jsonData);
        res.json({ success: true, message: 'Data sent to RabbitMQ' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

async function consumeMessages() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log('Waiting for messages...');

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                const jsonData = JSON.parse(msg.content.toString());
                console.log('Received message:', jsonData);

                await storeInPostgres(jsonData);

                channel.ack(msg);
            }
        });
    } catch (error) {
        console.error('Error consuming messages:', error);
    }
}

consumeMessages();



module.exports = router;

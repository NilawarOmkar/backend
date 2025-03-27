const express = require('express');
const amqp = require('amqplib');
const pool = require('../db')
const router = express.Router();
const RABBITMQ_URL = 'amqp://localhost';
const QUEUE_NAME = 'jsonQueue';
let channel;
const messages = [];

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        await channel.assertQueue("messages", { durable: true });

        console.log('✅ Connected to RabbitMQ and queue is ready.');

        channel.consume("messages", async (msg) => {
            if (msg !== null) {
                const jsonData = JSON.parse(msg.content.toString());

                messages.push(jsonData);
            }
        }, { noAck: false });

    } catch (error) {
        console.error('❌ Error connecting to RabbitMQ:', error);
        process.exit(1);
    }
}

connectRabbitMQ();

async function storeInPostgres(jsonData) {
    try {
        const query = `
            INSERT INTO messages (data, phone_number) 
            VALUES ($1, $2);
        `;

        const phone_number = jsonData.phone_number || null;

        await pool.query(query, [jsonData, phone_number]);
        console.log('Stored in PostgreSQL:', jsonData);
    } catch (error) {
        console.error('Error storing data in PostgreSQL:', error);
    }
}

router.get('/messages/:flow_id', async (req, res) => {
    try {
        const { flow_id } = req.params;

        const query = `
            SELECT * FROM messages WHERE flow_id = $1;
        `;

        const { rows } = await pool.query(query, [flow_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "No messages found for the given flow_id" });
        }

        res.json(rows);
    } catch (error) {
        console.error('Error retrieving messages:', error);
        res.status(500).json({ error: 'Failed to retrieve messages' });
    }
});

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

router.post('/replies', async (req, res) => {
    try {
        const jsonData = req.body;
        console.log("Attempting to store ", jsonData)
        if (!channel) {
            return res.status(500).json({ error: 'RabbitMQ not connected' });
        }
        channel.sendToQueue("messages", Buffer.from(JSON.stringify(jsonData)), { persistent: true });
        console.log('Message sent to RabbitMQ:', jsonData);
        res.json({ success: true, message: 'Data sent to RabbitMQ' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.get('/replies', async (req, res) => {
    try {
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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

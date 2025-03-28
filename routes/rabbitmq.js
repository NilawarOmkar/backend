const express = require('express');
const amqp = require('amqplib');
const pool = require('../db')
const router = express.Router();
const RABBITMQ_URL = 'amqp://localhost';
let connection;
let channel;

async function connectRabbitMQ() {
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue("jsonQueue", { durable: true });
        await channel.assertQueue("messages", { durable: true });
        consumeMessages();
        console.log('✅ Connected to RabbitMQ and queue is ready.');

    } catch (error) {
        console.error('❌ Error connecting to RabbitMQ:', error);
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
    } catch (error) {
        console.error('Error storing data in PostgreSQL:', error);
    }
}

async function storeReplyInPostgres(jsonData) {
    try {
        const query = `
            INSERT INTO replies (reply_data) 
            VALUES ($1);
        `;

        await pool.query(query, [jsonData]);
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
        if (!channel) {
            return res.status(500).json({ error: 'RabbitMQ not connected' });
        }

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(jsonData)), { persistent: true });
        res.json({ success: true, message: 'Data sent to RabbitMQ' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.post('/replies', async (req, res) => {
    try {
        const jsonData = req.body;
        if (!channel) {
            return res.status(500).json({ error: 'RabbitMQ not connected' });
        }
        channel.sendToQueue("messages", Buffer.from(JSON.stringify(jsonData)), { persistent: true });
        res.json({ success: true, message: 'Data sent to RabbitMQ' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.get('/replies', async (req, res) => {
    try {
        const query = `
            SELECT reply_data FROM replies;
        `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

async function consumeMessages() {
    try {
        console.log('Waiting for messages...');

        channel.consume("jsonQueue", async (msg) => {
            if (msg !== null) {
                const jsonData = JSON.parse(msg.content.toString());
                console.log('Received message:', jsonData);

                await storeInPostgres(jsonData);

                channel.ack(msg);
            }
        });

        channel.consume("messages", async (msg) => {
            if (msg !== null) {
                try {
                    const replyData = JSON.parse(msg.content.toString());
                    await storeReplyInPostgres(replyData);
                    channel.ack(msg);
                } catch (error) {
                    console.error('Failed to process reply:', error);
                    channel.nack(msg, false, true);
                }
            }
        });

    } catch (error) {
        console.error('Error consuming messages:', error);
    }
}

module.exports = router;

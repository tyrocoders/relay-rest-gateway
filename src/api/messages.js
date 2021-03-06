const relay = require('librelay');
const socketio = require('@feathersjs/socketio');


class OutgoingV1 {
    async create(data, params) {
        const atlas = await relay.AtlasClient.factory();
        data.distribution = await atlas.resolveTags(data.distribution);
        const sender = await relay.MessageSender.factory();
        return await sender.send(data);
    }
}


class IncomingV1 {

    setup(app, path) {
        this.socketNS = app.io.of(path);
        this.socketNS.on('connection', this.onConnection.bind(this));
    }

    async onConnection(socket) {
        if (!this.reciever) {
            this.reciever = await relay.MessageReceiver.factory();
            //this.reciever.addEventListener('keychange', this.onRecvKeyChange);
            this.reciever.addEventListener('message', this.onMessage.bind(this));
            //this.reciever.addEventListener('receipt', this.onRecvReceipt);
            this.reciever.addEventListener('sent', this.onSent.bind(this));
            //this.reciever.addEventListener('read', this.onRecvRead);
            //this.reciever.addEventListener('closingsession', this.onRecvClosingSession);
            this.reciever.addEventListener('error', this.onError.bind(this));
            await this.reciever.connect();
        }
        console.info("Client connected:", socket.ip);
        socket.join(this.path);
        socket.on('close', () => {
            console.warn("Client disconnected: ", req.ip);
            this.wsClients.delete(ws);
        });
    }

    async onMessage(ev) {
        const atlas = await relay.AtlasClient.factory();
        let body = JSON.parse(ev.data.message.body);
        body[0].senderTag = await atlas.getUsers([body[0].sender.userId]);
        body[0].distributionTags = await atlas.resolveTags(body[0].distribution.expression);
        for (const x of ev.data.message.attachments) {
            x.data = await this.reciever.fetchAttachment(x);
        }
        this.socketNS.emit('message', {
            expirationStartTimestamp: ev.data.expirationStartTimestamp,
            body: body,
            attachments: ev.data.message.attachments,
            source: ev.data.source,
            sourceDevice: ev.data.sourceDevice,
            timestamp: ev.data.timestamp,
        });

    }

    async onSent(ev) {
        for (const x of ev.data.message.attachments) {
            x.data = await this.reciever.fetchAttachment(x);
        }
        this.socketNS.emit('sent', {
            destination: ev.data.destination,
            expirationStartTimestamp: ev.data.expirationStartTimestamp,
            body: JSON.parse(ev.data.message.body),
            attachments: ev.data.message.attachments,
            source: ev.data.source,
            sourceDevice: ev.data.sourceDevice,
            timestamp: ev.data.timestamp,
        });
    }

    onError(ev) {
        debugger;
        this.socketNS.emit('error', ev);
    }
}


module.exports = {
    OutgoingV1,
    IncomingV1
};

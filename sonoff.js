'use strict';

module.exports = function (RED) {
    const debug = require('debug')('sonoff');

    function SonoffDevice(config) {
        // Create Node
        RED.nodes.createNode(this, config);

        // Setup mqtt broker
        const brokerConnection = RED.nodes.getNode(config.broker);

        // Topics
        var topicTeleLWT = `${config.telePrefix}/${config.device}/LWT`;

        var topicCmdPower = `${config.cmdPrefix}/${config.device}/power`;
        var topicCmdStatus = `${config.cmdPrefix}/${config.device}/status`;
        var topicCmdColor = `${config.cmdPrefix}/${config.device}/color`;
        var topicCmdColor2 = `${config.cmdPrefix}/${config.device}/color2`;
        var topicCmdColorTemperature = `${config.cmdPrefix}/${config.device}/CT`;
        var topicCmdDimmer = `${config.cmdPrefix}/${config.device}/dimmer`;

        var topicStatsPower = `${config.statPrefix}/${config.device}/POWER`;
        var topicStatsStatus = `${config.statPrefix}/${config.device}/STATUS`;

        if (config.mode == 1) { //Custom (%topic%/%prefix%/)
            topicTeleLWT = `${config.device}/${config.telePrefix}/LWT`;

            topicCmdPower = `${config.device}/${config.cmdPrefix}/power`;
            topicCmdStatus = `${config.device}/${config.cmdPrefix}/status`;

            topicStatsPower = `${config.device}/${config.statPrefix}/POWER`;
            topicStatsStatus = `${config.device}/${config.statPrefix}/STATUS`;
        }

        // add Multi-Channel Support for up to 8-Channel
        const channelNameToNumber = {
            "POWER": 0, // for single Channel Devices
            "POWER1": 0,
            "POWER2": 1,
            "POWER3": 2,
            "POWER4": 3,
            "POWER5": 4,
            "POWER6": 5,
            "POWER7": 6,
            "POWER8": 7
        };

        
        if (brokerConnection) {
            brokerConnection.register(this);
            this.status({
                fill: 'yellow',
                shape: 'dot',
                text: 'Connecting...'
            });

            // Check if the node is online
            brokerConnection.subscribe(topicTeleLWT, 2, (topic, payload) => {
                const stringPayload = payload.toString();
                debug('Topic: %s, Value: %s', topic, stringPayload);
                if (stringPayload === 'Online') {
                    this.status({
                        fill: 'green',
                        shape: 'ring',
                        text: 'Online'
                    });
                } else {
                    this.status({
                        fill: 'red',
                        shape: 'dot',
                        text: 'Offline'
                    });
                }
            });

            brokerConnection.subscribe(topicStatsStatus, 2, (topic, payload) => {
                const stringPayload = payload.toString();
                debug('Topic: %s, Value: %s', topic, stringPayload);
                try {
                    const jsonPayload = JSON.parse(stringPayload);
                    // Power value is a binary encoded number which we have to search for our channel
                    if ((jsonPayload.Status.Power & Math.pow(2, channelNameToNumber[config.channel])) != 0) {
                        this.status({
                            fill: 'green',
                            shape: 'dot',
                            text: 'On'
                        });
                        this.send({
                            payload: true
                        });
                    } else {
                        this.status({
                            fill: 'grey',
                            shape: 'dot',
                            text: 'Off'
                        });
                        this.send({
                            payload: false
                        });
                    }
                } catch (err) {
                    this.status({
                        fill: 'red',
                        shape: 'dot',
                        text: 'Error processing Status from device'
                    });
                    this.error(err, 'Error processing Status from device');
                }
            });

            // Subscribes if the state of the device changes
            brokerConnection.subscribe(topicStatsPower, 2, (topic, payload) => {
                const stringPayload = payload.toString();
                debug('Topic: %s, Value: %s', topic, stringPayload);

                if (stringPayload === config.onValue) {
                    this.status({fill: 'green',shape: 'dot',text: 'On'});
                    this.send({payload: true});
                }
                if (stringPayload === config.offValue) {
                    this.status({fill: 'grey',shape: 'dot',text: 'Off'});
                    this.send({payload: false});
                }
            });

            // On input we publish a true/false
            this.on('input', msg => {
                debug('INPUT: %s', JSON.stringify(msg));
                const payload = msg.payload;
                const topic = msg.topic;

                if ( topic == "color")
                {
                    debug('Topic: %s, Value: %s', topic, msg);
                    this.status({fill: 'green', shape: 'dot',text: 'Color sent'});
                    brokerConnection.client.publish(topicCmdColor, payload , {qos: 0,retain: false});
                    this.send({payload: true});
                }
                else if (RED.util.getMessageProperty(msg.payload, 'color')) {
                    debug('Topic: %s, Value: %s', topic, msg);
                    this.status({fill: 'green', shape: 'dot',text: 'Color sent'});
                    var color = RED.util.getMessageProperty(msg.payload, 'color');
                    brokerConnection.client.publish(topicCmdColor, color , {qos: 0,retain: false});
                    this.send({payload: true});
                } else if (RED.util.getMessageProperty(msg.payload, 'color2')) {
                    this.status({fill: 'green', shape: 'dot',text: 'Color sent'});
                    var color = RED.util.getMessageProperty(msg.payload, 'color2');
                    brokerConnection.client.publish(topicCmdColor2, color , {qos: 0,retain: false});
                    this.send({payload: true});
                } else if (RED.util.getMessageProperty(msg.payload, 'CT')) {
                    this.status({fill: 'green', shape: 'dot',text: 'ColorTemperature sent'});
                    var color = RED.util.getMessageProperty(msg.payload, 'CT');
                    brokerConnection.client.publish(topicCmdColorTemperature, color , {qos: 0,retain: false});
                    this.send({payload: true});
                } else if (payload == 'toggle') {
                    this.status({fill: 'green',shape: 'dot',text: 'Toggle sent'});
                    brokerConnection.client.publish(topicCmdPower, config.toggleValue, {qos: 0,retain: false});
                    this.send({ payload: true });
                } else if (payload == 'on') {
                    this.status({fill: 'green',shape: 'dot',text: 'ON sent'});
                    brokerConnection.client.publish(topicCmdPower, config.onValue, {qos: 0,retain: false});
                    this.send({ payload: true });
                } else if (payload == 'off') {
                    this.status({fill: 'green',shape: 'dot',text: 'OFF sent'});
                    brokerConnection.client.publish(topicCmdPower, config.offValue, {qos: 0,retain: false});
                    this.send({ payload: true });
                } else if (RED.util.getMessageProperty(msg.payload, 'dimmer')) {
                    this.status({fill: 'green',shape: 'dot',text: 'Dimmer sent'});
                    var dimm = RED.util.getMessageProperty(msg.payload, 'dimmer');
                    brokerConnection.client.publish(topicCmdDimmer, dimm, {qos: 0,retain: false});
                    this.send({payload: true});
                } else {
                    this.status({fill: 'red',shape: 'dot',text: 'unknown command'});
                    debug('Topic: %s, Value: %s', topic, msg);
                }
            });

            // Publish a start command to get the Status
            brokerConnection.client.publish(topicCmdStatus);
            this.status({
                fill: 'yellow',
                shape: 'ring',
                text: 'Requesting Status...'
            });

            // Remove Connections
            this.on('close', done => {
                brokerConnection.unsubscribe(topicTeleLWT, this.id);
                brokerConnection.unsubscribe(topicStatsPower, this.id);
                brokerConnection.unsubscribe(topicStatsStatus, this.id);
                brokerConnection.deregister(this, done);
            });
        } else {
            this.status({
                fill: 'red',
                shape: 'dot',
                text: 'Could not connect to mqtt'
            });
        }
    }

    RED.nodes.registerType('Sonoff device Enhanced', SonoffDevice);
};

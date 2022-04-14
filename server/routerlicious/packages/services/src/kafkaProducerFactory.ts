/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { inspect } from "util";
import winston from "winston";
import { IContextErrorData, IProducer } from "@fluidframework/server-services-core";
import { KafkaNodeProducer } from "@fluidframework/server-services-ordering-kafkanode";
import { RdkafkaProducer } from "@fluidframework/server-services-ordering-rdkafka";
import { Lumberjack } from "@fluidframework/server-services-telemetry";

export function createProducer(
    type: string,
    kafkaEndPoint: string,
    clientId: string,
    topic: string,
    enableIdempotence?: boolean,
    pollIntervalMs?: number,
    numberOfPartitions?: number,
    replicationFactor?: number,
    maxBatchSize?: number,
    sslCACertFilePath?: string): IProducer {
    let producer: IProducer;

    if (type === "rdkafka") {
        producer = new RdkafkaProducer(
            { kafka: [kafkaEndPoint] },
            clientId,
            topic,
            {
                enableIdempotence,
                pollIntervalMs,
                numberOfPartitions,
                replicationFactor,
                maxBatchSize,
                sslCACertFilePath,
            });

        producer.on("error", (error, errorData: IContextErrorData) => {
            if (errorData?.restart) {
                throw new Error(error);
            } else {
                winston.error("Kafka Producer emitted an error that is not configured to restart the process.");
                winston.error(inspect(error));
                Lumberjack.error(
                    "Kafka Producer emitted an error that is not configured to restart the process.",
                    undefined,
                    error);
            }
        });
    } else {
        producer = new KafkaNodeProducer(
            { kafkaHost: kafkaEndPoint },
            clientId,
            topic,
            numberOfPartitions,
            replicationFactor,
            maxBatchSize);
        producer.on("error", (error) => {
            winston.error(error);
            Lumberjack.error(error);
        });
    }

    return producer;
}

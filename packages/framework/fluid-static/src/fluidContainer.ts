/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { TypedEventEmitter } from "@fluidframework/common-utils";
import { Container } from "@fluidframework/container-loader";
import { IFluidLoadable } from "@fluidframework/core-interfaces";
import { IEvent, IEventProvider } from "@fluidframework/common-definitions";
import { AttachState } from "@fluidframework/container-definitions";
import { LoadableObjectClass, LoadableObjectRecord } from "./types";
import { RootDataObject } from "./rootDataObject";

export interface IFluidContainerEvents extends IEvent {
    (event: "connected" | "dispose" | "disconnected", listener: () => void): void;
}

export interface IFluidContainer extends IEventProvider<IFluidContainerEvents> {
    readonly connected: boolean;
    readonly disposed: boolean;
    readonly initialObjects: LoadableObjectRecord;
    create<T extends IFluidLoadable>(objectClass: LoadableObjectClass<T>): Promise<T>;
    dispose(): void;
}

export class FluidContainer extends TypedEventEmitter<IFluidContainerEvents> implements IFluidContainer {
    private readonly connectedHandler = () => this.emit("connected");
    private readonly disconnectedHandler = () => this.emit("disconnected");
    private readonly disposedHandler = () => this.emit("disposed");

    public constructor(
        private readonly container: Container,
        private readonly rootDataObject: RootDataObject,
        private readonly attachCallback: () => Promise<string>,
    ) {
        super();
        container.on("connected", this.connectedHandler);
        container.on("closed", this.disposedHandler);
        container.on("disconnected", this.disconnectedHandler);
    }

    public get attachState(): AttachState {
        return this.container.attachState;
    }

    public get disposed() {
        return this.container.closed;
    }

    public get connected() {
        return this.container.connected;
    }

    public get initialObjects() {
        return this.rootDataObject.initialObjects;
    }

    public async attach() {
        if (this.attachState === AttachState.Detached) {
            return this.attachCallback();
        } else {
            throw new Error("Cannot attach container. Container is not in detached state");
        }
    }

    public async create<T extends IFluidLoadable>(objectClass: LoadableObjectClass<T>): Promise<T> {
        return this.rootDataObject.create(objectClass);
    }

    public dispose() {
        this.container.close();
        this.container.off("connected", this.connectedHandler);
        this.container.off("closed", this.disposedHandler);
        this.container.off("disconnected", this.disconnectedHandler);
    }
}

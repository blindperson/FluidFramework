/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import * as semver from "semver";
import { adjustVersion, VersionBumpTypeExtended } from "@fluidframework/build-tools";
import { bumpInternalVersion, getVersionRange } from "./internalVersionScheme";
import { detectVersionScheme } from "./schemes";

/**
 * Return the version RANGE incremented by the bump type (major, minor, or patch).
 *
 * @remarks
 *
 * Only simple "^" and "~" ranges and Fluid internal version scheme ranges are supported.
 *
 * @param range - A dependency range string to increment.
 * @param bumpType - The type of bump.
 * @param prerelease - If true, will bump to a prerelease version.
 * @returns a bumped range string.
 */
export function incRange(
    range: string,
    bumpType: VersionBumpTypeExtended,
    prerelease = false,
): string {
    if (semver.validRange(range) === null) {
        throw new Error(`${range} is not a valid semver range.`);
    }

    const scheme = detectVersionScheme(range);
    switch (scheme) {
        case "virtualPatch":
        case "semver": {
            const operator = range.slice(0, 1);
            const isPreciseVersion = operator !== "^" && operator !== "~";
            const original = isPreciseVersion ? range : range.slice(1);
            const parsedVersion = semver.parse(original);
            const originalNoPrerelease = `${parsedVersion?.major}.${parsedVersion?.minor}.${parsedVersion?.patch}`;
            const newVersion =
                bumpType === "current"
                    ? originalNoPrerelease
                    : scheme === "virtualPatch"
                    ? adjustVersion(originalNoPrerelease, bumpType, "virtualPatch")
                    : semver.inc(originalNoPrerelease, bumpType);
            if (newVersion === null) {
                throw new Error(`Failed to increment ${original}.`);
            }
            return `${isPreciseVersion ? "" : operator}${newVersion}${prerelease ? "-0" : ""}`;
        }

        case "internal": {
            const constraintType = detectConstraintType(range);
            const original = semver.minVersion(range);
            if (original === null) {
                throw new Error(`Couldn't determine minVersion from ${range}.`);
            }
            const newVersion = bumpInternalVersion(original, bumpType);
            return getVersionRange(newVersion, constraintType);
        }

        default: {
            throw new Error(`${scheme} wasn't handled. Was a new version scheme added?`);
        }
    }
}

// export function removePrerelease(range: string): string {
//     const scheme = detectVersionScheme(range);
//     const isPrerelease = semver.prerelease(range)?.length ?? 0 > 0;
//     if(!isPrerelease) {
//         return range;
//     }
//     switch (scheme) {
//         case "internal": {
//             throw new Error(`Cannot remove prerelease secrtions from Fluid internal version ranges.`);
//         }
//         default: {
//             const ver = semver.parse()
//             return `${}`
//         }

// }

export function detectConstraintType(range: string): "minor" | "patch" {
    const minVer = semver.minVersion(range);
    if (minVer === null) {
        throw new Error(`Couldn't determine minVersion from ${range}.`);
    }

    const patch = bumpInternalVersion(minVer, "patch");
    const minor = bumpInternalVersion(minVer, "minor");

    const maxSatisfying = semver.maxSatisfying([patch, minor], range);
    return maxSatisfying === patch ? "patch" : "minor";
}
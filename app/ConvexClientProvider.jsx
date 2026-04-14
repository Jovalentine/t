"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo } from 'react';

const ConvexClientProvider = ({ children }) => {
    const convex = useMemo(
        () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL),
        []
    );
    return (
        <ConvexProvider client={convex}>
            {children}
        </ConvexProvider>
    );
};

export default ConvexClientProvider;
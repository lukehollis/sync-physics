interface RequestData {
    callback: string;
    input: Record<string, any>;
    output?: Record<string, any>;
}

export class APIConcept {
    private requests: Map<string, RequestData> = new Map();
    private requestCounter = 0;

    request(args: Record<string, any>): { request: string } {
        const requestId = `request_${this.requestCounter++}`;
        
        console.log(`APIConcept.request called with:`, args, `-> ${requestId}`);
        
        // Extract callback from args (but keep it in args for pattern matching)
        const callback = args.callback || '';
        
        // Store the full args including callback
        this.requests.set(requestId, {
            callback,
            input: args
        });
        
        return { request: requestId };
    }

    response(args: { request: string } & Record<string, any>): { request: string } {
        const requestData = this.requests.get(args.request);
        if (requestData) {
            const { request, ...output } = args;
            requestData.output = output;
        }
        return { request: args.request };
    }

    // Query functions
    _getRequest(args: { request: string }): Array<RequestData> {
        const data = this.requests.get(args.request);
        return data ? [data] : [];
    }

    _getPendingRequests(): Array<{ request: string; callback: string; input: Record<string, any> }> {
        const pending: Array<{ request: string; callback: string; input: Record<string, any> }> = [];
        
        this.requests.forEach((data, id) => {
            if (!data.output) {
                pending.push({
                    request: id,
                    callback: data.callback,
                    input: data.input
                });
            }
        });
        
        return pending;
    }
}

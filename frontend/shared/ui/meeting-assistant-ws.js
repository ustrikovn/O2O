;(function(){
    function MeetingAssistantWS({ baseUrl = 'ws://localhost:3001/ws/assistant', meetingId, employeeId, onEvent }){
        this.url = baseUrl;
        this.meetingId = meetingId;
        this.employeeId = employeeId;
        this.onEvent = onEvent || function(){};
        this.ws = null;
        this.pending = [];
    }

    MeetingAssistantWS.prototype.connect = function(){
        var self = this;
        this.ws = new WebSocket(this.url);
        this.ws.addEventListener('open', () => {
            self._sendNow({ type: 'join', meetingId: self.meetingId, employeeId: self.employeeId });
            // flush queue
            if (self.pending && self.pending.length) {
                self.pending.forEach(function(evt){ self._sendNow(evt); });
                self.pending = [];
            }
        });
        this.ws.addEventListener('message', (e) => {
            try {
                const data = JSON.parse(e.data);
                this.onEvent(data);
            } catch(e){}
        });
        this.ws.addEventListener('close', () => {
            var self = this;
            setTimeout(function(){ self.connect(); }, 1500);
        });
    };

    MeetingAssistantWS.prototype._sendNow = function(evt){
        try { this.ws && this.ws.send(JSON.stringify(evt)); } catch(e){}
    };

    MeetingAssistantWS.prototype.send = function(evt){
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._sendNow(evt);
        } else {
            this.pending.push(evt);
        }
    };

    MeetingAssistantWS.prototype.sendUserMessage = function(text){
        this.send({ type: 'user_message', text: text });
    };

    MeetingAssistantWS.prototype.sendNotesUpdate = function(text){
        this.send({ type: 'notes_update', text: text });
    };

    window.MeetingAssistantWS = MeetingAssistantWS;
})();



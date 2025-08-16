import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/Card';
import { Label } from './ui/Label';
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';
import { FeedbackModalState } from '../views/ChatView';

interface FeedbackModalProps {
    state: FeedbackModalState;
    setState: (state: FeedbackModalState) => void;
    onSubmit: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ state, setState, onSubmit }) => {
    if (!state.isOpen) {
        return null;
    }

    return (
        <div className="feedback-modal-overlay">
            <div className="feedback-modal-content">
                <Card>
                    <CardHeader>
                        <CardTitle>Provide Feedback</CardTitle>
                        <CardDescription>Your feedback helps the AI improve. What went wrong with the response?</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Label htmlFor="feedback-text">Feedback</Label>
                            <Textarea
                                id="feedback-text"
                                placeholder="e.g., The code provided had a syntax error."
                                value={state.feedbackText}
                                onChange={(e) => setState({ ...state, feedbackText: e.target.value })}
                                className="min-h-[100px]"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setState({ isOpen: false, messageId: null, feedbackText: '' })}>Cancel</Button>
                        <Button onClick={onSubmit} disabled={!state.feedbackText.trim()}>Submit & Retry</Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};

export default FeedbackModal;
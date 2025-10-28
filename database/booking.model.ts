import { Schema, model, models, Document, Types } from 'mongoose';
import Event from './event.model';

// TypeScript interface for Booking document
export interface IBooking extends Document {
    eventId: Types.ObjectId;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            trim: true,
            lowercase: true,
            validate: {
                validator: function (email: string) {
                    // RFC 5322 compliant email validation regex
                    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
                    return emailRegex.test(email);
                },
                message: 'Please provide a valid email address',
            },
        },
    },
    {
        timestamps: true, // Auto-generate createdAt and updatedAt
    }
);

// ⚠️ WARNING: This pre-save hook only checks if the referenced event exists,
// but it does NOT guarantee atomicity. The event could be deleted between this check
// and the actual save operation, leading to potential data inconsistency.
//
// For production-grade integrity, DO NOT rely on this hook alone.
// Instead, use the transactional booking creation functions in `booking.utils.ts`
// which ensure atomicity using MongoDB sessions and transactions.
BookingSchema.pre('save', async function (next) {
    const booking = this as IBooking;

    if (booking.isModified('eventId') || booking.isNew) {
        try {
            const eventExists = await Event.findById(booking.eventId).select('_id');
            if (!eventExists) {
                const error = new Error(`Event with ID ${booking.eventId} does not exist`);
                error.name = 'ValidationError';
                return next(error);
            }
        } catch {
            const validationError = new Error('Invalid event ID format or database error');
            validationError.name = 'ValidationError';
            return next(validationError);
        }
    }

    next();
});

// Indexes for performance and constraints
BookingSchema.index({ eventId: 1 });
BookingSchema.index({ eventId: 1, createdAt: -1 });
BookingSchema.index({ email: 1 });
BookingSchema.index({ eventId: 1, email: 1 }, { unique: true, name: 'uniq_event_email' });

const Booking = models.Booking || model<IBooking>('Booking', BookingSchema);

export default Booking;
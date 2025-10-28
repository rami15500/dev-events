import mongoose, { ClientSession, Types } from 'mongoose';
import Booking, { IBooking } from './booking.model';
import Event from './event.model';

/**
 * Creates a booking with full transactional guarantees.
 * 
 * This function ensures atomicity by:
 * 1. Starting a MongoDB session and transaction
 * 2. Re-checking event existence within the transaction
 * 3. Creating and saving the booking within the same transaction
 * 4. Committing on success or aborting on error
 * 
 * This prevents race conditions where an event could be deleted between
 * validation and booking creation.
 * 
 * @param eventId - The ID of the event to book
 * @param email - The email address of the person booking
 * @returns The created booking document
 * @throws Error if the event doesn't exist or booking creation fails
 */
export async function createBookingWithTransaction(
    eventId: string | Types.ObjectId,
    email: string
): Promise<IBooking> {
    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {
        // Step 1: Verify event exists within the transaction
        const eventExists = await Event.findById(eventId)
            .select('_id')
            .session(session);

        if (!eventExists) {
            throw new Error(`Event with ID ${eventId} does not exist`);
        }

        // Step 2: Create the booking within the transaction
        const bookingData = {
            eventId: typeof eventId === 'string' ? new Types.ObjectId(eventId) : eventId,
            email: email.trim().toLowerCase(),
        };

        const [booking] = await Booking.create([bookingData], { session });

        // Step 3: Commit the transaction
        await session.commitTransaction();

        return booking;
    } catch (error) {
        // Abort transaction on any error
        await session.abortTransaction();
        
        // Re-throw the error with context
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to create booking: Unknown error');
    } finally {
        // Always end the session
        await session.endSession();
    }
}

/**
 * Updates a booking email with transactional guarantees.
 * 
 * @param bookingId - The ID of the booking to update
 * @param newEmail - The new email address
 * @returns The updated booking document
 * @throws Error if the booking doesn't exist or update fails
 */
export async function updateBookingWithTransaction(
    bookingId: string | Types.ObjectId,
    newEmail: string
): Promise<IBooking | null> {
    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find and update booking within transaction
        const booking = await Booking.findById(bookingId).session(session);

        if (!booking) {
            throw new Error(`Booking with ID ${bookingId} does not exist`);
        }

        booking.email = newEmail.trim().toLowerCase();
        await booking.save({ session });

        await session.commitTransaction();

        return booking;
    } catch (error) {
        await session.abortTransaction();
        
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to update booking: Unknown error');
    } finally {
        await session.endSession();
    }
}

/**
 * Deletes a booking with transactional guarantees.
 * 
 * @param bookingId - The ID of the booking to delete
 * @returns True if deleted, false if not found
 */
export async function deleteBookingWithTransaction(
    bookingId: string | Types.ObjectId
): Promise<boolean> {
    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {
        const result = await Booking.findByIdAndDelete(bookingId).session(session);
        
        await session.commitTransaction();
        
        return !!result;
    } catch (error) {
        await session.abortTransaction();
        
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to delete booking: Unknown error');
    } finally {
        await session.endSession();
    }
}

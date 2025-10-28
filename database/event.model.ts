import { Schema, model, models, Document } from 'mongoose';

// TypeScript interface for Event document
export interface IEvent extends Document {
    title: string;
    slug: string;
    description: string;
    overview: string;
    image: string;
    venue: string;
    location: string;
    date: string;
    time: string;
    mode: string;
    audience: string;
    agenda: string[];
    organizer: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            maxlength: [100, 'Title cannot exceed 100 characters'],
        },
        slug: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },
        overview: {
            type: String,
            required: [true, 'Overview is required'],
            trim: true,
            maxlength: [500, 'Overview cannot exceed 500 characters'],
        },
        image: {
            type: String,
            required: [true, 'Image URL is required'],
            trim: true,
        },
        venue: {
            type: String,
            required: [true, 'Venue is required'],
            trim: true,
        },
        location: {
            type: String,
            required: [true, 'Location is required'],
            trim: true,
        },
        date: {
            type: String,
            required: [true, 'Date is required'],
        },
        time: {
            type: String,
            required: [true, 'Time is required'],
        },
        mode: {
            type: String,
            required: [true, 'Mode is required'],
            enum: {
                values: ['online', 'offline', 'hybrid'],
                message: 'Mode must be either online, offline, or hybrid',
            },
        },
        audience: {
            type: String,
            required: [true, 'Audience is required'],
            trim: true,
        },
        agenda: {
            type: [String],
            required: [true, 'Agenda is required'],
            validate: {
                validator: (v: string[]) => v.length > 0,
                message: 'At least one agenda item is required',
            },
        },
        organizer: {
            type: String,
            required: [true, 'Organizer is required'],
            trim: true,
        },
        tags: {
            type: [String],
            required: [true, 'Tags are required'],
            validate: {
                validator: (v: string[]) => v.length > 0,
                message: 'At least one tag is required',
            },
        },
    },
    {
        timestamps: true, // Auto-generate createdAt and updatedAt
    }
);

// Pre-save hook for slug generation and data normalization
EventSchema.pre('save', async function (next) {
    const event = this as IEvent;

    // Generate slug only if title changed or document is new
    if (event.isModified('title') || event.isNew) {
        try {
            event.slug = await generateUniqueSlug(event.title, event._id);
        } catch (error) {
            return next(error as Error);
        }
    }

    // Normalize date to ISO format if it's not already
    if (event.isModified('date')) {
        try {
            event.date = normalizeDate(event.date);
        } catch (error) {
            return next(error as Error);
        }
    }

    // Normalize time format (HH:MM)
    if (event.isModified('time')) {
        try {
            event.time = normalizeTime(event.time);
        } catch (error) {
            return next(error as Error);
        }
    }

    next();
});

// Helper function to generate URL-friendly slug
function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generates a unique slug by checking for collisions and appending a counter.
 * 
 * @param title - The title to generate the slug from
 * @param excludeId - The ID of the current document (to exclude from collision check when updating)
 * @returns A unique slug
 * @throws Error if unable to generate unique slug or database error occurs
 */
async function generateUniqueSlug(title: string, excludeId?: any): Promise<string> {
    const baseSlug = generateSlug(title);
    const MAX_ATTEMPTS = 100;
    let slug = baseSlug;
    let counter = 1;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            // Check if slug exists (excluding current document if updating)
            const query = excludeId 
                ? { slug, _id: { $ne: excludeId } }
                : { slug };
            
            const existingEvent = await Event.findOne(query).select('_id').lean();

            if (!existingEvent) {
                // Slug is unique
                return slug;
            }

            // Collision detected, append counter
            slug = `${baseSlug}-${counter}`;
            counter++;
        } catch (error) {
            // Propagate database errors
            if (error instanceof Error) {
                throw new Error(`Failed to generate unique slug: ${error.message}`);
            }
            throw new Error('Failed to generate unique slug: Unknown error');
        }
    }

    // If we exhausted all attempts, throw error
    throw new Error(`Unable to generate unique slug after ${MAX_ATTEMPTS} attempts`);
}

// Helper function to normalize date to ISO format
function normalizeDate(dateString: string): string {
    // Check if already in YYYY-MM-DD format
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDateRegex.test(dateString)) {
        // Validate it's a real date
        const date = new Date(dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
        }
        return dateString;
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
    }
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Helper function to normalize time format
function normalizeTime(timeString: string): string {
    // Handle various time formats and convert to HH:MM (24-hour format)
    const timeRegex = /^(\d{1,2}):(\d{2})(\s*(AM|PM))?$/i;
    const match = timeString.trim().match(timeRegex);

    if (!match) {
        throw new Error('Invalid time format. Use HH:MM or HH:MM AM/PM');
    }

    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[4]?.toUpperCase();

    if (period) {
        // Convert 12-hour to 24-hour format
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
    }

    if (hours < 0 || hours > 23 || parseInt(minutes) < 0 || parseInt(minutes) > 59) {
        throw new Error('Invalid time values');
    }

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

// Create unique index on slug for better performance
EventSchema.index({ slug: 1 }, { unique: true });

// Create compound index for common queries
EventSchema.index({ date: 1, mode: 1 });

const Event = models.Event || model<IEvent>('Event', EventSchema);

export default Event;
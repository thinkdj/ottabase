import { BrandKit, LayoutRouteMapping, LayoutTemplate, MenuSlotAssignment } from '@ottabase/brand-engine/persistence';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import {
    clearConnection,
    hasConnection,
    initRLS,
    registerConnection,
    registerModels,
    registerPolicy,
    RLSPolicies,
} from '@ottabase/ottaorm';
import {
    Account,
    Authenticator,
    Organization,
    OrganizationMember,
    Permission,
    Role,
    ScheduledTask,
    Session,
    UserRole,
    VerificationToken,
} from '@ottabase/ottaorm/models';
import { Shortlink } from '@ottabase/shortlinks';
import { errorResponse } from '@ottabase/utils/http-errors';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { ResumeApplicationDossier } from '../../ottabase/models/ResumeApplicationDossier';
import { ResumeApplicationDossierFile } from '../../ottabase/models/ResumeApplicationDossierFile';
import { ResumeCertification } from '../../ottabase/models/ResumeCertification';
import { ResumeDataSet } from '../../ottabase/models/ResumeDataSet';
import { ResumeEducation } from '../../ottabase/models/ResumeEducation';
import { ResumeProfile } from '../../ottabase/models/ResumeProfile';
import { ResumeProject } from '../../ottabase/models/ResumeProject';
import { ResumeSaved } from '../../ottabase/models/ResumeSaved';
import { ResumeSkillSet } from '../../ottabase/models/ResumeSkillSet';
import { ResumeWorkExperience } from '../../ottabase/models/ResumeWorkExperience';
import type { CloudflareEnv } from '../cloudflare-env';
import { readJson } from './utils';

export function initAdminCron(env: CloudflareEnv): Response | null {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));
    return null;
}

export async function checkMigrationAuth(request: Request, env: CloudflareEnv): Promise<boolean> {
    const isDev = env.ENVIRONMENT === 'development' || !env.ENVIRONMENT;
    if (isDev) return true;

    if (!env.MIGRATION_SECRET) return false;

    let providedSecret: string | null = null;
    const url = new URL(request.url);
    providedSecret = url.searchParams.get('secret');

    if (!providedSecret && request.method === 'POST') {
        const body = await readJson<{ secret?: string }>(request);
        providedSecret = body.secret ?? null;
    }

    if (!providedSecret) {
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            providedSecret = authHeader.substring(7);
        }
    }

    return providedSecret === env.MIGRATION_SECRET;
}

export function initDbConnection(env: CloudflareEnv): void {
    if (!env.OBCF_D1) return;

    if (hasConnection('default')) {
        clearConnection('default');
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const packages = getOttabaseConfig(env).packages;
    const coreModels = [
        Account,
        Authenticator,
        Session,
        VerificationToken,
        ScheduledTask,
        Organization,
        OrganizationMember,
        Role,
        UserRole,
        Permission,
    ];
    const packageModels: (typeof Account)[] = [...(packages.shortlinks ? [Shortlink] : [])];
    // Menu, MenuItem: use /api/brand/menus (cache-invalidating CRUD), not OttaORM
    const brandModels = [BrandKit, LayoutTemplate, LayoutRouteMapping, MenuSlotAssignment];
    const appModels = [
        ResumeProfile,
        ResumeSkillSet,
        ResumeWorkExperience,
        ResumeEducation,
        ResumeProject,
        ResumeCertification,
        ResumeDataSet,
        ResumeSaved,
        ResumeApplicationDossier,
        ResumeApplicationDossierFile,
    ];

    registerModels([...coreModels, ...packageModels, ...brandModels, ...appModels]);

    initRLS();

    // Register RLS policies for resume models — each is user-scoped (filtered by userId)
    const resumeEntities = [
        'resume_profiles',
        'resume_skill_sets',
        'resume_work_experiences',
        'resume_educations',
        'resume_projects',
        'resume_certifications',
        'resume_data_sets',
        'resume_saved',
        'resume_application_dossiers',
        'resume_application_dossier_files',
    ];
    for (const entity of resumeEntities) {
        registerPolicy({ model: entity, policy: RLSPolicies.UserScoped(), auditEnabled: true });
    }
}

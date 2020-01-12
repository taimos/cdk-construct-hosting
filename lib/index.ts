import { Certificate, DnsValidatedCertificate } from '@aws-cdk/aws-certificatemanager';
import { CloudFrontWebDistribution, OriginAccessIdentity, PriceClass, ViewerCertificate, ViewerProtocolPolicy } from '@aws-cdk/aws-cloudfront';
import { ARecord, HostedZone, RecordTarget } from '@aws-cdk/aws-route53';
import { CloudFrontTarget } from '@aws-cdk/aws-route53-targets';
import { Bucket } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import { Construct } from '@aws-cdk/core';

export interface SinglePageAppHostingProps {
    /**
     * Name of the domain to deploy
     */
    readonly domainName : string;
    /**
     * Name of the HostedZone of the domain
     * 
     * @default - same a the domain name
     */
    readonly zoneName? : string;
    /**
     * Name of the index document
     * 
     * @default index.html
     */
    readonly indexFile? : string;
    /**
     * The ARN of the certificate; Has to be in us-east-1
     *
     * @default - create a new certificate in us-east-1
     */
    readonly certArn? : string;
    /**
     * ID of the HostedZone of the domain
     *
     * @default - lookup zone from context using the zone name
     */
    readonly zoneId? : string;
    /**
     * local folder with contents for the website bucket
     *
     * @default - no file deployment
     */
    readonly webFolder? : string;
}

export class SinglePageAppHosting extends Construct {

    public readonly webBucket : Bucket;

    public readonly distribution : CloudFrontWebDistribution;

    constructor(scope : Construct, id : string, props : SinglePageAppHostingProps) {
        super(scope, id);

        const zoneName = props.zoneName ?? props.domainName;

        const zone = props.zoneId ? HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            hostedZoneId: props.zoneId,
            zoneName,
        }) : HostedZone.fromLookup(this, 'HostedZone', { domainName: zoneName });

        const cert = props.certArn ?
            Certificate.fromCertificateArn(this, 'Certificate', props.certArn) :
            new DnsValidatedCertificate(this, 'Certificate', {
                hostedZone: zone,
                domainName: props.domainName,
                region: 'us-east-1',
            });

        const originAccessIdentity = new OriginAccessIdentity(this, 'OAI', { comment: props.domainName });
        this.webBucket = new Bucket(this, 'WebBucket', { websiteIndexDocument: props.indexFile ?? 'index.html' });
        this.webBucket.grantRead(originAccessIdentity);

        this.distribution = new CloudFrontWebDistribution(this, 'Distribution', {
            originConfigs: [{
                behaviors: [{ isDefaultBehavior: true }],
                s3OriginSource: {
                    s3BucketSource: this.webBucket,
                    originAccessIdentity,
                },
            }],
            viewerCertificate: ViewerCertificate.fromAcmCertificate(cert, {
                aliases: [props.domainName],
            }),
            errorConfigurations: [{
                errorCode: 403,
                responseCode: 200,
                responsePagePath: `/${props.indexFile ?? 'index.html'}`,
            }, {
                errorCode: 404,
                responseCode: 200,
                responsePagePath: `/${props.indexFile ?? 'index.html'}`,
            }],
            comment: `${props.domainName} Website`,
            priceClass: PriceClass.PRICE_CLASS_ALL,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        });

        if (props.webFolder) {
            new BucketDeployment(this, 'DeployWebsite', {
                sources: [Source.asset(props.webFolder)],
                destinationBucket: this.webBucket,
                distribution: this.distribution,
            });
        }

        new ARecord(this, 'AliasRecord', {
            recordName: props.domainName,
            zone,
            target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
        });
    }
}

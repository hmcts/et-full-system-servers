FROM ruby:3.3.0-alpine

RUN addgroup app --gid 1000
RUN adduser -SD -u 1000 --shell /bin/bash --home /home/app app app


ARG APPVERSION=unknown
ARG APP_BUILD_DATE=unknown
ARG APP_GIT_COMMIT=unknown
ARG APP_BUILD_TAG=unknown

# Setting up ping.json variables
ENV APPVERSION ${APPVERSION}
ENV APP_BUILD_DATE ${APP_BUILD_DATE}
ENV APP_GIT_COMMIT ${APP_GIT_COMMIT}
ENV APP_BUILD_TAG ${APP_BUILD_TAG}

EXPOSE 9000
EXPOSE 9100
EXPOSE 9200

COPY --chown=app:app . /home/app/fake_services
RUN chown -R app:app /usr/local/bundle
RUN apk add --no-cache unzip zip libpq-dev tzdata gettext shared-mime-info bash && \
    apk add --no-cache postgresql-client~=11.12 --repository=http://dl-cdn.alpinelinux.org/alpine/v3.10/main && \
    apk add --no-cache --virtual .build-tools git build-base && \
    cd /home/app/fake_services && \
    gem install bundler -v 2.2.6 && \
    bundle install --no-cache --jobs=5 --retry=3 --deployment && \
    apk del .build-tools && \
    chown -R app:app /usr/local/bundle && \
    mkdir -p /home/app/fake_services/tmp && \
    chown -R app:app /home/app/fake_services/tmp


USER app
ENV HOME /home/app
WORKDIR /home/app/fake_services
CMD ["./bin/foreman", "start", "--port", "9000"]
